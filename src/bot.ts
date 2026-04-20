import { Bot, Context, InputFile } from 'grammy'
import {
  TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, TELEGRAM_ALLOWED_USERS,
  MAX_MESSAGE_LENGTH, TYPING_REFRESH_MS, SHOW_COST_FOOTER,
  IDLE_LOCK_MINUTES,
} from './config.js'
import { runAgentDispatch } from './agent.js'
import { buildMemoryContext, saveConversationTurn, shouldNudgeMemory } from './memory.js'
import { trackUsage, isOverBudget } from './rate-tracker.js'
import { formatCostFooter } from './cost-footer.js'
import { enqueue, getQueueLength } from './message-queue.js'
import { runHooks } from './hooks.js'
import { classifyMessage } from './message-classifier.js'
import { redactSecrets, containsSecrets } from './exfiltration-guard.js'
import { isLocked, unlock, lock, checkKillPhrase, audit } from './security.js'
import {
  logConversation, getRecentAuditLog, getAllTasks, getMissionTasks,
  logAuditEvent,
} from './db.js'
import {
  activeSessions, abortControllers, voiceEnabledChats,
  touchActivity, chatEvents, emitChatEvent,
} from './state.js'
import { transcribeAudio } from './voice.js'
import { extractMediaMessage, describeMedia } from './media.js'
import { routeMessage, listAgents } from './orchestrator.js'
import { loadAgentConfigs, getAgentRegistry } from './agent-config.js'
import { scheduleTask, getScheduledTasks, pauseTask, resumeTask, removeTask } from './scheduler.js'
import { listSkills, getSkillContent } from './skill-registry.js'
import { checkOAuthHealth, formatHealthReport } from './oauth-health.js'
import { checkSkillHealth, formatSkillHealthReport } from './skill-health.js'
import { logger } from './logger.js'

// ── Allowed senders ──────────────────────────────────────────────────────────

const ALLOWED_USERS = new Set(
  TELEGRAM_ALLOWED_USERS.split(',').map(u => u.trim()).filter(Boolean)
)

function isAllowed(ctx: Context): boolean {
  const chatId = String(ctx.chat?.id ?? '')
  const userId = String(ctx.from?.id ?? '')
  const username = ctx.from?.username ?? ''

  if (ALLOWED_CHAT_ID && chatId === ALLOWED_CHAT_ID) return true
  if (ALLOWED_USERS.has(userId) || ALLOWED_USERS.has(username)) return true
  if (!ALLOWED_CHAT_ID && ALLOWED_USERS.size === 0) return true // dev mode
  return false
}

// ── Formatting ───────────────────────────────────────────────────────────────

function escHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function formatForTelegram(text: string): string {
  // Escape special HTML chars except intentional formatting tags
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Convert markdown to Telegram HTML
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre>$1</pre>')
}

function chunk(text: string, size: number): string[] {
  const parts: string[] = []
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size))
  return parts
}

async function sendLong(ctx: Context, text: string): Promise<void> {
  const safe = redactSecrets(text)
  const parts = chunk(safe, MAX_MESSAGE_LENGTH - 200)
  for (const part of parts) {
    try {
      await ctx.reply(formatForTelegram(part), { parse_mode: 'HTML' })
    } catch {
      await ctx.reply(part) // plain fallback
    }
  }
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function startTyping(ctx: Context): NodeJS.Timeout {
  const action = () => ctx.replyWithChatAction('typing').catch(() => {})
  action()
  return setInterval(action, TYPING_REFRESH_MS)
}

// ── Core message handler ──────────────────────────────────────────────────────

export async function handleMessage(ctx: Context, text: string, agentId = 'orchestrator'): Promise<string> {
  const chatId = String(ctx.chat?.id ?? 'unknown')
  touchActivity()
  emitChatEvent({ type: 'user_message', chatId, agentId, data: text })

  // Kill phrase check (before lock check)
  if (checkKillPhrase(text, chatId)) {
    return 'Emergency shutdown initiated.'
  }

  // Lock check
  if (isLocked()) {
    if (text.startsWith('/unlock ')) {
      const pin = text.slice('/unlock '.length).trim()
      if (unlock(pin, chatId)) return 'System unlocked.'
      return 'Wrong PIN.'
    }
    return 'System is locked. Use /unlock <PIN> to continue.'
  }

  // Exfiltration guard
  if (containsSecrets(text)) {
    audit('secret_detected_in_input', chatId, `len=${text.length}`)
    logger.warn({ chatId }, 'Potential secret in user message — proceeding with caution')
  }

  // Budget check
  if (isOverBudget(chatId)) {
    return 'Token budget exceeded. Try again later or check /stats.'
  }

  // @agent delegation
  const delegation = await routeMessage(text, chatId)
  if (delegation) {
    if (delegation.error) return `[${delegation.agentId}] Error: ${delegation.error}`
    trackUsage(chatId, delegation.agentId, delegation.tokens, delegation.cost)
    saveConversationTurn(chatId, delegation.agentId, text, delegation.result)
    const footer = formatCostFooter('claude-sonnet-4-6', 0, delegation.tokens, SHOW_COST_FOOTER)
    return delegation.result + footer
  }

  // Memory context
  const memCtx = await buildMemoryContext(chatId, text)
  const nudge = shouldNudgeMemory(chatId)

  const parts: string[] = []
  if (memCtx) parts.push(`## Memory\n${memCtx}`)
  if (nudge) parts.push('*Note: Take a moment to reflect on what you have learned about this user.*')
  parts.push(text)

  const fullPrompt = parts.join('\n\n')

  // Run agent
  const { result, tokens, cost, model } = await runAgentDispatch({ chatId, agentId, message: fullPrompt })

  trackUsage(chatId, agentId, tokens, cost, model)
  saveConversationTurn(chatId, text, result, agentId)
  logConversation(chatId, 'user', text, agentId)
  logConversation(chatId, 'assistant', result, agentId)

  const footer = formatCostFooter(model, 0, tokens, SHOW_COST_FOOTER)
  return result + footer
}

// ── Console entry point (for dashboard) ──────────────────────────────────────

export async function processConsoleMessage(text: string): Promise<string> {
  const fakeCtx = { chat: { id: 'dashboard' }, from: { id: 'dashboard' }, reply: async () => {}, replyWithChatAction: async () => {} } as any
  return handleMessage(fakeCtx, text)
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function cmdStart(ctx: Context): Promise<void> {
  await ctx.reply(
    '<b>⚡ ClaudeClaw OS</b>\n\nYour AI assistant is online.\n\n' +
    'Send any message to begin. Use /help for commands.',
    { parse_mode: 'HTML' }
  )
}

async function cmdHelp(ctx: Context): Promise<void> {
  const helpText = `<b>ClaudeClaw OS Commands</b>

<b>General</b>
/start — Initialize
/help — This message
/status — System status
/health — API health check
/stats — Token usage

<b>Agents</b>
/agents — List agents
@agentName task — Delegate to agent

<b>Scheduler</b>
/tasks — List scheduled tasks
/schedule name | cron | prompt — Create task
/pause &lt;id&gt; — Pause task
/resume &lt;id&gt; — Resume task
/deltask &lt;id&gt; — Delete task

<b>Mission</b>
/missions — List mission tasks

<b>Memory</b>
/memory — Memory summary
/forget — Clear memory for this chat

<b>Voice</b>
/voice — Toggle voice transcription

<b>Security</b>
/lock — Lock system
/unlock &lt;PIN&gt; — Unlock system

<b>Skills</b>
/skills — List available skills
/skill &lt;name&gt; — Use a skill

<b>System</b>
/reset — Reset agent session
/abort — Abort running task
/audit — Recent audit log`

  await ctx.reply(helpText, { parse_mode: 'HTML' })
}

async function cmdStatus(ctx: Context): Promise<void> {
  const { getDailyUsage, getHourlyUsage } = await import('./rate-tracker.js')
  const daily = getDailyUsage()
  const hourly = getHourlyUsage()
  const registry = getAgentRegistry()
  const locked = isLocked()

  const lines = [
    '<b>ClaudeClaw OS Status</b>',
    '',
    `🔒 System: ${locked ? 'LOCKED' : 'unlocked'}`,
    `🤖 Agents: ${registry.size} registered`,
    `📊 Daily: ${daily.tokens.toLocaleString()} tokens | $${daily.cost.toFixed(4)}`,
    `⏱ Hourly: ${hourly.tokens.toLocaleString()} tokens | $${hourly.cost.toFixed(4)}`,
    `📋 Active sessions: ${activeSessions.size}`,
  ]

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdAgents(ctx: Context): Promise<void> {
  const agents = listAgents()
  if (agents.length === 0) {
    await ctx.reply('No agents configured.')
    return
  }
  const lines = ['<b>Registered Agents</b>', '']
  for (const a of agents) {
    lines.push(`• <b>@${escHtml(a.id)}</b> — ${escHtml(a.name)}\n  ${escHtml(a.description)}`)
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdTasks(ctx: Context): Promise<void> {
  const tasks = getScheduledTasks()
  if (tasks.length === 0) { await ctx.reply('No scheduled tasks.'); return }
  const lines = ['<b>Scheduled Tasks</b>', '']
  for (const t of tasks) {
    const next = t.next_run ? new Date(t.next_run).toLocaleString() : 'never'
    lines.push(`• <b>${escHtml(t.id.slice(0, 10))}…</b> [${escHtml(t.status)}]\n  ${escHtml(t.schedule)} → next: ${escHtml(next)}`)
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdSchedule(ctx: Context, args: string): Promise<void> {
  // Format: name | cron | prompt
  const parts = args.split('|').map(p => p.trim())
  if (parts.length < 3) {
    await ctx.reply('Usage: /schedule name | cron | prompt\nExample: /schedule daily-brief | 0 9 * * * | Write a morning briefing')
    return
  }
  try {
    const task = scheduleTask({
      name: parts[0],
      cronExpr: parts[1]!,
      prompt: parts.slice(2).join('|').trim(),
      chatId: String(ctx.chat?.id ?? 'scheduler'),
    })
    await ctx.reply(`✓ Task created: ${task.id}\nNext run: ${task.next_run ? new Date(task.next_run).toLocaleString() : '?'}`)
  } catch (err) {
    await ctx.reply(`Error: ${(err as Error).message}`)
  }
}

async function cmdMissions(ctx: Context): Promise<void> {
  const tasks = getMissionTasks()
  if (tasks.length === 0) { await ctx.reply('No mission tasks.'); return }
  const lines = ['<b>Mission Tasks</b>', '']
  for (const t of tasks) {
    lines.push(`• <b>#${escHtml(t.id.slice(0, 10))}</b> [${escHtml(t.status)}] ${escHtml(t.priority_label)}\n  ${escHtml(t.title ?? t.prompt)}`)
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdMemory(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const { getMemoriesForChat, getRecentConsolidations } = await import('./db.js')
  const memories = getMemoriesForChat(chatId, 5)
  const consolidations = getRecentConsolidations(chatId, 1)

  if (memories.length === 0) { await ctx.reply('No memories stored for this chat.'); return }

  const lines = [`<b>Memory</b> (${memories.length} recent)`, '']
  for (const m of memories) {
    const pin = m.pinned ? '📌 ' : ''
    lines.push(`• <code>#${m.id}</code> ${pin}[${(m.importance * 100).toFixed(0)}%] ${escHtml(m.summary?.slice(0, 100) ?? m.raw_text?.slice(0, 80))}`)
  }
  if (consolidations[0]) {
    lines.push('', '<b>Latest Insight</b>', consolidations[0].insight ?? consolidations[0].summary)
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdForget(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const { deleteOldLowImportanceMemories } = await import('./db.js')
  deleteOldLowImportanceMemories(chatId, 0, 1.0)
  await ctx.reply('Memory cleared for this chat.')
}

async function cmdRemember(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const text = String(ctx.match ?? '').trim()
  if (!text) {
    await ctx.reply('Usage: /remember &lt;fact to store&gt;\n\nExample: /remember My client meeting with John is every Tuesday at 2pm', { parse_mode: 'HTML' })
    return
  }
  try {
    const { ingestConversationTurn } = await import('./memory-ingest.js')
    const { saveMemory, pinMemory } = await import('./db.js')
    const { getEmbedding } = await import('./gemini.js')
    const { embeddingToBuffer } = await import('./embeddings.js')

    // Extract + embed
    const { callGemini } = await import('./gemini.js')
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
    await ctx.reply(`📌 Remembered: <i>${escHtml(extracted.summary ?? text)}</i>`, { parse_mode: 'HTML' })
  } catch (err) {
    await ctx.reply(`Failed to save memory: ${(err as Error).message}`)
  }
}

async function cmdPinMemory(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const arg = String(ctx.match ?? '').trim()
  if (!arg) {
    await ctx.reply('Usage: /pin &lt;memory_id&gt;\n\nGet IDs from /memory', { parse_mode: 'HTML' })
    return
  }
  const id = parseInt(arg)
  if (isNaN(id)) { await ctx.reply('Memory ID must be a number.'); return }
  try {
    const { pinMemory, getMemoryById } = await import('./db.js')
    const m = getMemoryById(id)
    if (!m || m.chat_id !== chatId) { await ctx.reply('Memory not found.'); return }
    pinMemory(id, true)
    await ctx.reply(`📌 Pinned memory #${id}: <i>${escHtml(m.summary?.slice(0, 80))}</i>`, { parse_mode: 'HTML' })
  } catch (err) {
    await ctx.reply(`Error: ${(err as Error).message}`)
  }
}

async function cmdVoice(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  if (voiceEnabledChats.has(chatId)) {
    voiceEnabledChats.delete(chatId)
    await ctx.reply('Voice transcription disabled.')
  } else {
    voiceEnabledChats.add(chatId)
    await ctx.reply('Voice transcription enabled. Send voice messages to transcribe.')
  }
}

async function cmdLock(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  lock(chatId)
  await ctx.reply('System locked.')
}

async function cmdReset(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const { clearSession } = await import('./db.js')
  clearSession(chatId)
  await ctx.reply('Session reset.')
}

async function cmdAbort(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? '')
  const ctrl = abortControllers.get(chatId)
  if (ctrl) {
    ctrl.abort()
    abortControllers.delete(chatId)
    await ctx.reply('Task aborted.')
  } else {
    await ctx.reply('No running task to abort.')
  }
}

async function cmdAudit(ctx: Context): Promise<void> {
  const entries = getRecentAuditLog(10)
  if (entries.length === 0) { await ctx.reply('No audit log entries.'); return }
  const lines = ['<b>Audit Log</b>', '']
  for (const e of entries) {
    const ts = new Date(e.created_at).toLocaleTimeString()
    lines.push(`• [${ts}] ${e.event_type}${e.details ? ': ' + e.details : ''}`)
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
}

async function cmdSkills(ctx: Context): Promise<void> {
  const skills = listSkills()
  if (skills.length === 0) { await ctx.reply('No skills registered.'); return }
  const lines = [`**Available Skills** (${skills.length})`, '']
  for (const s of skills) {
    lines.push(`• \`${s.name}\` — ${s.description.slice(0, 80)}`)
  }
  await sendLong(ctx, lines.join('\n'))
}

async function cmdSkill(ctx: Context, name: string): Promise<void> {
  if (!name) { await ctx.reply('Usage: /skill <name>'); return }
  const content = getSkillContent(name)
  if (!content) { await ctx.reply(`Skill "${name}" not found.`); return }

  const typingTimer = startTyping(ctx)
  try {
    const result = await handleMessage(ctx, `[Invoking skill: ${name}]\n\n${content}`)
    await sendLong(ctx, result)
  } finally {
    clearInterval(typingTimer)
  }
}

async function cmdHealth(ctx: Context): Promise<void> {
  await ctx.replyWithChatAction('typing')
  const results = await checkOAuthHealth()
  await ctx.reply('<b>API Health</b>\n\n<pre>' + formatHealthReport(results) + '</pre>', { parse_mode: 'HTML' })
}

async function cmdStats(ctx: Context): Promise<void> {
  const chatId = String(ctx.chat?.id ?? undefined)
  const { getDailyUsage, getHourlyUsage } = await import('./rate-tracker.js')
  const daily = getDailyUsage(chatId)
  const hourly = getHourlyUsage(chatId)
  await ctx.reply(
    `<b>Usage Stats</b>\n\nDaily: ${daily.tokens.toLocaleString()} tokens | $${daily.cost.toFixed(4)}\nHourly: ${hourly.tokens.toLocaleString()} tokens | $${hourly.cost.toFixed(4)}`,
    { parse_mode: 'HTML' }
  )
}

// ── Bot initialization ────────────────────────────────────────────────────────

let _bot: Bot | null = null

export function createBot(): Bot {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set')

  const bot = new Bot(TELEGRAM_BOT_TOKEN)

  // Guard middleware
  bot.use(async (ctx, next) => {
    if (!isAllowed(ctx)) {
      logger.warn({ chatId: ctx.chat?.id, userId: ctx.from?.id }, 'Unauthorized access attempt')
      return
    }
    await next()
  })

  // Commands
  bot.command('start', cmdStart)
  bot.command('help', cmdHelp)
  bot.command('status', cmdStatus)
  bot.command('agents', cmdAgents)
  bot.command('tasks', cmdTasks)
  bot.command('missions', cmdMissions)
  bot.command('memory', cmdMemory)
  bot.command('remember', cmdRemember)
  bot.command('pin', cmdPinMemory)
  bot.command('forget', cmdForget)
  bot.command('voice', cmdVoice)
  bot.command('lock', cmdLock)
  bot.command('reset', cmdReset)
  bot.command('abort', cmdAbort)
  bot.command('audit', cmdAudit)
  bot.command('skills', cmdSkills)
  bot.command('health', cmdHealth)
  bot.command('stats', cmdStats)

  bot.command('schedule', async (ctx) => {
    const args = ctx.match ?? ''
    await cmdSchedule(ctx, args)
  })

  bot.command('pause', async (ctx) => {
    const id = ctx.match?.trim()
    if (!id) { await ctx.reply('Usage: /pause <task-id>'); return }
    pauseTask(id)
    await ctx.reply(`Task ${id} paused.`)
  })

  bot.command('resume', async (ctx) => {
    const id = ctx.match?.trim()
    if (!id) { await ctx.reply('Usage: /resume <task-id>'); return }
    resumeTask(id)
    await ctx.reply(`Task ${id} resumed.`)
  })

  bot.command('deltask', async (ctx) => {
    const id = ctx.match?.trim()
    if (!id) { await ctx.reply('Usage: /deltask <task-id>'); return }
    removeTask(id)
    await ctx.reply(`Task ${id} deleted.`)
  })

  bot.command('unlock', async (ctx) => {
    const pin = ctx.match?.trim()
    const chatId = String(ctx.chat?.id ?? '')
    if (!pin) { await ctx.reply('Usage: /unlock <PIN>'); return }
    if (unlock(pin, chatId)) {
      await ctx.reply('System unlocked.')
    } else {
      await ctx.reply('Wrong PIN.')
    }
  })

  bot.command('skill', async (ctx) => {
    await cmdSkill(ctx, ctx.match?.trim() ?? '')
  })

  // Voice message handler
  bot.on('message:voice', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? '')
    if (!voiceEnabledChats.has(chatId)) {
      await ctx.reply('Voice transcription is off. Enable with /voice.')
      return
    }
    try {
      const voice = ctx.message.voice
      const { downloadTelegramFile } = await import('./media.js')
      const buf = await downloadTelegramFile(voice.file_id)
      const transcript = await transcribeAudio(buf, voice.mime_type ?? 'audio/ogg')
      if (!transcript) { await ctx.reply('Could not transcribe voice message.'); return }

      await ctx.reply(`🎙 <i>${formatForTelegram(transcript)}</i>`, { parse_mode: 'HTML' })

      const typingTimer = startTyping(ctx)
      try {
        const reply = await handleMessage(ctx, transcript)
        await sendLong(ctx, reply)
      } finally {
        clearInterval(typingTimer)
      }
    } catch (err) {
      logger.error({ err }, 'Voice message handler error')
      await ctx.reply('Error processing voice message.')
    }
  })

  // Photo/document handler
  bot.on(['message:photo', 'message:document'], async (ctx) => {
    const media = await extractMediaMessage(ctx.message as any)
    if (!media) return
    const desc = describeMedia(media)
    const caption = (ctx.message as any).caption ?? ''
    const text = caption ? `${desc}\n${caption}` : desc

    const typingTimer = startTyping(ctx)
    try {
      const reply = await handleMessage(ctx, text)
      await sendLong(ctx, reply)
    } finally {
      clearInterval(typingTimer)
    }
  })

  // Text message handler
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    if (!text || text.startsWith('/')) return

    const chatId = String(ctx.chat?.id ?? '')

    // Pre-message hooks
    const hookCtx = await runHooks('pre_message', {
      chatId,
      agentId: 'orchestrator',
      message: text,
    })
    if (hookCtx.blocked) {
      if (hookCtx.response) await ctx.reply(hookCtx.response)
      return
    }

    // Enqueue to prevent concurrent processing for same chat
    await enqueue(chatId, async () => {
      const complexity = classifyMessage(text)
      activeSessions.set(chatId, { startedAt: Date.now(), agentId: 'orchestrator' })
      const typingTimer = startTyping(ctx)
      const ctrl = new AbortController()
      abortControllers.set(chatId, ctrl)

      try {
        emitChatEvent({ type: 'processing', chatId, agentId: 'orchestrator', data: text })
        const reply = await handleMessage(ctx, text)

        // Post-message hooks
        const postCtx = await runHooks('post_message', {
          chatId,
          agentId: 'orchestrator',
          message: text,
          response: reply,
        })

        await sendLong(ctx, postCtx.response ?? reply)
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          await ctx.reply('Task aborted.')
        } else {
          logger.error({ err, chatId }, 'Message handler error')
          emitChatEvent({ type: 'error', chatId, data: (err as Error).message })
          await ctx.reply('An error occurred. Please try again.')
        }
      } finally {
        clearInterval(typingTimer)
        abortControllers.delete(chatId)
        activeSessions.delete(chatId)
      }
    })
  })

  _bot = bot
  return bot
}

export function getBot(): Bot | null {
  return _bot
}

export function isBotPolling(): boolean {
  return _bot !== null
}

export async function startBot(): Promise<void> {
  await loadAgentConfigs()
  const bot = createBot()
  logger.info('Starting Telegram bot…')
  await bot.start({
    onStart: () => logger.info('Telegram bot polling started'),
  })
}

export async function stopBot(): Promise<void> {
  if (_bot) {
    await _bot.stop()
    _bot = null
  }
}
