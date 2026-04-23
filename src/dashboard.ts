import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { streamSSE } from 'hono/streaming'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { DASHBOARD_PORT, DASHBOARD_TOKEN } from './config.js'
import { getDashboardHtml } from './dashboard-html.js'
import { getDailyUsage, getHourlyUsage } from './rate-tracker.js'
import { getAllTasks, getMissionTasks, getMemoryStats, getTopMemories, getRecentConsolidationsGlobal, getConversationChats, getConversationHistoryPaged, createMissionTask, saveMemory, pinMemory } from './db.js'
import { getAgentRegistry } from './agent-config.js'
import { activeSessions, chatEvents } from './state.js'
import { checkOAuthHealth } from './oauth-health.js'
import { listSkills, reloadSkillRegistry } from './skill-registry.js'
import { scheduleTask } from './scheduler.js'
import { isSchedulerRunning } from './scheduler.js'
import { isConsolidationLoopRunning } from './memory-consolidate.js'
import { isBotPolling } from './bot.js'
import { isWhatsAppConnected, getWhatsAppQr } from './whatsapp.js'
import { getDb } from './db.js'
import { TELEGRAM_BOT_TOKEN, WHATSAPP_ALLOWED_USERS } from './config.js'
import { logger } from './logger.js'
import { getUsageStats, triggerScan } from './usage-tracker.js'

const app = new Hono()

// ---------- Auth middleware ----------

function authCheck(token: string | undefined): boolean {
  if (!DASHBOARD_TOKEN) return true // No token = open (dev mode)
  return token === DASHBOARD_TOKEN
}

app.use('*', async (c, next) => {
  if (c.req.path === '/') { await next(); return }
  const token = c.req.query('token') ?? c.req.header('Authorization')?.replace('Bearer ', '')
  if (!authCheck(token)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// ---------- Routes ----------

app.get('/', (c) => {
  return c.html(getDashboardHtml(DASHBOARD_TOKEN))
})

app.get('/manual', (c) => {
  const manualPath = join(process.cwd(), 'public', 'manual.html')
  if (!existsSync(manualPath)) return c.text('Manual not found', 404)
  return c.html(readFileSync(manualPath, 'utf-8'))
})

app.get('/api/stream', (c) => {
  return streamSSE(c, async (s) => {
    s.onAbort(() => { alive = false })

    const sendEvent = async (type: string, data: unknown) => {
      await s.writeSSE({ event: type, data: JSON.stringify(data) })
    }

    // Initial payload
    await sendEvent('stats', await buildStatsPayload())
    await sendEvent('agents', buildAgentsPayload())
    await sendEvent('tasks', buildTasksPayload())
    await sendEvent('skills', buildSkillsPayload())
    await sendEvent('memory', buildMemoryPayload())
    await sendEvent('health', await buildHealthPayload())

    // Forward chat events as log lines
    const onChat = async (ev: any) => {
      if (ev.type === 'processing') {
        await sendEvent('log', { level: 'info', msg: `[${ev.agentId ?? 'system'}] processing…` })
      } else if (ev.type === 'error') {
        await sendEvent('log', { level: 'error', msg: `[${ev.agentId ?? 'system'}] ${String(ev.data)}` })
      }
    }
    chatEvents.on('chat', onChat)

    // Push stats every 15s
    let alive = true
    const ticker = setInterval(async () => {
      if (!alive) return
      try {
        await sendEvent('stats', await buildStatsPayload())
        await sendEvent('agents', buildAgentsPayload())
      } catch { alive = false }
    }, 15_000)

    // Keep alive
    while (alive) {
      await new Promise(r => setTimeout(r, 30_000))
      try { await s.writeSSE({ data: '' }) } catch { alive = false }
    }

    clearInterval(ticker)
    chatEvents.off('chat', onChat)
  })
})

app.get('/api/stats', async (c) => {
  return c.json(await buildStatsPayload())
})

app.get('/api/agents', (c) => {
  return c.json(buildAgentsPayload())
})

app.get('/api/tasks', (c) => {
  return c.json(buildTasksPayload())
})

app.get('/api/health', async (c) => {
  return c.json(await buildHealthPayload())
})

app.get('/api/skills', (c) => {
  return c.json(buildSkillsPayload())
})

app.get('/api/memory', (c) => {
  return c.json(buildMemoryPayload())
})

app.post('/api/memory', async (c) => {
  const body = await c.req.json() as { text?: string; chatId?: string }
  const text = body.text?.trim()
  if (!text) return c.json({ error: 'text required' }, 400)
  const chatId = body.chatId?.trim() || 'dashboard'

  try {
    const { callGemini, getEmbedding } = await import('./gemini.js')
    const { embeddingToBuffer } = await import('./embeddings.js')

    const raw = await callGemini(
      `Extract a memory from this user-supplied fact. Return ONLY valid JSON:\n{"summary":"one-sentence summary","entities":["..."],"topics":["..."],"importance":0.9}\nFact: ${text}`
    )
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim()
    const extracted = JSON.parse(cleaned)
    const embedding = await getEmbedding(extracted.summary ?? text)

    const id = saveMemory({
      chat_id: chatId,
      agent_id: 'user',
      raw_text: text,
      summary: extracted.summary ?? text,
      entities: JSON.stringify(extracted.entities ?? []),
      topics: JSON.stringify(extracted.topics ?? []),
      importance: Math.max(0.9, extracted.importance ?? 0.9),
      salience: 5,
      pinned: 1,
      consolidated: 0,
      embedding: embeddingToBuffer(embedding),
      superseded_by: null,
      created_at: Date.now(),
      accessed_at: Date.now(),
    })
    pinMemory(id, true)
    return c.json({ ok: true, id, summary: extracted.summary ?? text })
  } catch (err: any) {
    return c.json({ error: String(err.message) }, 500)
  }
})

app.get('/api/whatsapp/qr', (c) => {
  return c.json({ qr: getWhatsAppQr(), connected: isWhatsAppConnected() })
})

app.get('/api/history', (c) => {
  return c.json(getConversationChats())
})

app.get('/api/history/:chatId', (c) => {
  const chatId = decodeURIComponent(c.req.param('chatId'))
  const limit = parseInt(c.req.query('limit') ?? '60')
  const offset = parseInt(c.req.query('offset') ?? '0')
  return c.json(getConversationHistoryPaged(chatId, limit, offset))
})

app.post('/api/missions', async (c) => {
  const body = await c.req.json() as { title?: string; prompt?: string; agentId?: string; priority?: string }
  const { title, prompt, agentId, priority } = body
  if (!title?.trim() || !prompt?.trim()) return c.json({ error: 'title and prompt required' }, 400)
  const mission = createMissionTask({ title: title.trim(), description: prompt.trim(), agent_id: agentId ?? 'orchestrator', priority: priority ?? 'medium' })
  return c.json({ ok: true, id: mission.id })
})

app.post('/api/tasks', async (c) => {
  const body = await c.req.json() as { name?: string; prompt?: string; cronExpr?: string; agentId?: string }
  const { name, prompt, cronExpr, agentId } = body
  if (!prompt?.trim() || !cronExpr?.trim()) return c.json({ error: 'prompt and cronExpr required' }, 400)
  try {
    const task = scheduleTask({ name: name?.trim(), prompt: prompt.trim(), cronExpr: cronExpr.trim(), agentId: agentId ?? 'orchestrator' })
    return c.json({ ok: true, id: task.id })
  } catch (err: any) {
    return c.json({ error: String(err.message) }, 400)
  }
})

app.post('/api/skills/reload', (c) => {
  reloadSkillRegistry()
  return c.json({ count: listSkills().length })
})

// ---------- Usage / Cost tracking ----------

app.get('/api/usage', (c) => {
  const data = getUsageStats()
  if (!data) return c.json({ error: 'No usage data. Click Scan to build the database.' }, 404)
  return c.json(data)
})

app.post('/api/usage/scan', (c) => {
  const result = triggerScan()
  return c.json(result)
})

app.post('/api/send', async (c) => {
  const body = await c.req.json() as { message?: string }
  const msg = body.message?.trim()
  if (!msg) return c.json({ error: 'message required' }, 400)

  // Import bot's handleMessage lazily to avoid circular deps
  try {
    const { processConsoleMessage } = await import('./bot.js') as any
    if (typeof processConsoleMessage === 'function') {
      const reply = await processConsoleMessage(msg)
      return c.json({ reply })
    }
  } catch { /* bot not loaded */ }

  return c.json({ reply: '(bot not available)' })
})

// ---------- Payload builders ----------

async function buildStatsPayload() {
  const daily = getDailyUsage()
  const hourly = getHourlyUsage()
  return {
    dailyTokens: daily.tokens,
    dailyCost: daily.cost,
    hourlyTokens: hourly.tokens,
    activeSessions: activeSessions.size,
    memoryCount: 0,
    queueDepth: 0,
    tokenHistory: [],
    costHistory: [],
  }
}

function buildAgentsPayload() {
  const registry = getAgentRegistry()
  return [...registry.values()].map(a => ({
    id: a.id,
    name: a.name,
    model: a.model,
    active: activeSessions.has(a.id),
  }))
}

function buildTasksPayload() {
  return {
    scheduled: getAllTasks(),
    missions: getMissionTasks(),
  }
}

function buildSkillsPayload() {
  return listSkills().map(s => ({
    name: s.name,
    description: s.description,
    category: s.category ?? 'general',
    enabled: s.enabled,
  }))
}

function buildMemoryPayload() {
  const stats = getMemoryStats()
  const memories = getTopMemories(10)
  const consolidations = getRecentConsolidationsGlobal(3)
  return { stats, memories, consolidations }
}

async function buildHealthPayload() {
  const external = await checkOAuthHealth()

  // Local service status
  let dbOk = false
  try { getDb().prepare('SELECT 1').get(); dbOk = true } catch { /* db down */ }

  const local = [
    { service: 'Database',     category: 'local' as const, configured: true, reachable: dbOk,                        error: dbOk ? undefined : 'unavailable' },
    { service: 'Scheduler',    category: 'local' as const, configured: true, reachable: isSchedulerRunning() },
    { service: 'Memory Loop',  category: 'local' as const, configured: true, reachable: isConsolidationLoopRunning() },
    { service: 'Telegram Bot', category: 'messaging' as const, configured: !!TELEGRAM_BOT_TOKEN,  reachable: isBotPolling() },
    { service: 'WhatsApp',     category: 'messaging' as const, configured: !!WHATSAPP_ALLOWED_USERS, reachable: isWhatsAppConnected() },
  ]

  // Remove duplicate Telegram/WhatsApp entries from external (added there as placeholders)
  const deduped = external.filter(s => s.service !== 'Telegram Bot' && s.service !== 'WhatsApp')

  return { services: [...deduped, ...local], checkedAt: Date.now() }
}

// ---------- Start ----------

let _server: ReturnType<typeof serve> | null = null

export function startDashboard(): void {
  if (_server) return
  _server = serve({ fetch: app.fetch, port: DASHBOARD_PORT }, (info) => {
    logger.info({ port: info.port }, 'Dashboard started')
    console.log(`\n  Dashboard: http://localhost:${info.port}\n`)
  })
}

export function stopDashboard(): void {
  if (_server) {
    _server.close()
    _server = null
  }
}

// Auto-start when run directly: tsx src/dashboard.ts or node dist/dashboard.js
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDatabase()
  startDashboard()
}
