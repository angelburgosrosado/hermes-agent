import path from 'path'
import { fileURLToPath } from 'url'
import { WHATSAPP_ALLOWED_USERS, PROJECT_ROOT } from './config.js'
import { saveWaMessage, getPendingWaOutbox, markWaSent, logAuditEvent, queueWaOutbox } from './db.js'
import { runAgentDispatch } from './agent.js'
import { buildMemoryContext, saveConversationTurn } from './memory.js'
import { redactSecrets } from './exfiltration-guard.js'
import { logger } from './logger.js'

export interface WAMessage {
  id: string
  from: string
  body: string
  timestamp: number
  isGroup: boolean
  groupId?: string
}

let _client: any = null
let _ready = false
let _pendingQr: string | null = null

export function isWhatsAppConnected(): boolean {
  return _ready
}

export function getWhatsAppQr(): string | null {
  return _pendingQr
}

const SESSION_DIR = path.join(PROJECT_ROOT, 'store', 'whatsapp-session')

const ALLOWED = new Set(
  WHATSAPP_ALLOWED_USERS.split(',').map(u => u.trim()).filter(Boolean)
)

function isAllowedSender(from: string): boolean {
  if (ALLOWED.size === 0) return false // deny all if no allowlist
  // Telegram-style: strip @c.us suffix
  const normalized = from.replace(/@c\.us$/, '')
  return ALLOWED.has(normalized) || ALLOWED.has(from)
}

async function loadClient(): Promise<any> {
  // Dynamic import to avoid breaking the whole process if whatsapp-web.js is absent
  const pkg = await import('whatsapp-web.js')
  const { Client, LocalAuth } = (pkg.default ?? pkg) as any
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })
  return client
}

export async function startWhatsApp(): Promise<void> {
  try {
    _client = await loadClient()
  } catch (err) {
    logger.error({ err }, 'whatsapp-web.js not available — WhatsApp bridge disabled')
    return
  }

  _client.on('qr', (qr: string) => {
    _pendingQr = qr
    logger.info('WhatsApp QR code ready — scan via dashboard or terminal')
    console.log('\n=== WhatsApp QR Code ===')
    console.log(qr)
    console.log('========================\n')
  })

  _client.on('ready', () => {
    _ready = true
    _pendingQr = null
    logger.info('WhatsApp client ready')
  })

  _client.on('disconnected', (reason: string) => {
    _ready = false
    _pendingQr = null
    logger.warn({ reason }, 'WhatsApp disconnected')
  })

  _client.on('message', async (msg: any) => {
    try {
      await handleIncoming(msg)
    } catch (err) {
      logger.error({ err }, 'Error handling WhatsApp message')
    }
  })

  await _client.initialize()
}

async function handleIncoming(msg: any): Promise<void> {
  const from: string = msg.from
  const body: string = msg.body ?? ''
  const isGroup = from.endsWith('@g.us')

  // Only respond to allowed direct message senders
  if (isGroup) return
  if (!isAllowedSender(from)) {
    logger.warn({ from }, 'WA message from non-allowed sender — ignored')
    return
  }

  const waMsg: WAMessage = {
    id: msg.id._serialized,
    from,
    body,
    timestamp: Date.now(),
    isGroup,
  }

  saveWaMessage(waMsg.id, `wa:${from}`, from, body, waMsg.timestamp)
  logAuditEvent('wa_message_received', `len=${body.length}`, from)
  logger.info({ from, len: body.length }, 'WA message received')

  // Build response via agent
  const chatId = `wa:${from}`
  const memCtx = await buildMemoryContext(chatId, body)
  const prompt = memCtx ? `${memCtx}\n\n---\n\nUser: ${body}` : body

  const { result } = await runAgentDispatch({ chatId, agentId: 'orchestrator', message: prompt })
  const safeResult = redactSecrets(result)

  // Save conversation turn
  saveConversationTurn(chatId, body, safeResult, 'orchestrator')

  await sendMessage(from, safeResult)
}

export async function sendMessage(to: string, text: string): Promise<boolean> {
  if (!_ready || !_client) {
    queueWaOutbox(to, text)
    logger.warn({ to }, 'WA not ready — queued message in outbox')
    return false
  }
  try {
    await _client.sendMessage(to, text)
    logAuditEvent('wa_message_sent', `len=${text.length}`, to)
    return true
  } catch (err) {
    logger.error({ err, to }, 'Failed to send WA message')
    saveWaOutbox(to, text)
    return false
  }
}

function saveWaOutbox(to: string, text: string): void {
  try { queueWaOutbox(to, text) } catch { /* ignore */ }
}

export async function flushOutbox(): Promise<void> {
  if (!_ready || !_client) return
  const pending = getPendingWaOutbox()
  for (const item of pending) {
    try {
      await _client.sendMessage(item.to_number, item.body)
      markWaSent(item.id)
      logger.info({ id: item.id, to: item.to_number }, 'WA outbox flushed')
    } catch (err) {
      logger.error({ err, id: item.id }, 'Failed to flush WA outbox item')
    }
  }
}

export function isWhatsAppReady(): boolean {
  return _ready
}

export async function stopWhatsApp(): Promise<void> {
  if (_client) {
    try { await _client.destroy() } catch { /* ignore */ }
    _client = null
    _ready = false
  }
}
