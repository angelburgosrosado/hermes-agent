import { query } from '@anthropic-ai/claude-agent-sdk'
import { readEnvFile } from './env.js'
import { PROJECT_ROOT, AGENT_TIMEOUT_MS, AGENT_MAX_TURNS } from './config.js'
import { classifyError } from './errors.js'
import { logger } from './logger.js'

// Higher-level dispatch interface used by orchestrator, scheduler, etc.
export interface AgentDispatchOptions {
  chatId: string
  agentId: string
  message: string
  abortSignal?: AbortSignal
}

export interface AgentDispatchResult {
  result: string
  tokens: number
  cost: number
  model: string
  error?: string
}

export interface AgentOptions {
  message: string
  sessionId?: string
  agentId?: string
  cwd?: string
  onTyping?: () => void
  maxTurns?: number
  abortSignal?: AbortSignal
}

export interface AgentResult {
  text: string | null
  newSessionId?: string
  inputTokens?: number
  outputTokens?: number
  model?: string
}

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  const { message, sessionId, cwd, onTyping, maxTurns, abortSignal } = opts
  const env = readEnvFile()

  let text: string | null = null
  let newSessionId: string | undefined
  let inputTokens = 0
  let outputTokens = 0
  let model: string | undefined

  // Keep typing indicator alive
  let typingInterval: ReturnType<typeof setInterval> | null = null
  if (onTyping) {
    typingInterval = setInterval(() => { try { onTyping() } catch { /* ok */ } }, 4000)
  }

  const timeoutMs = AGENT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  if (abortSignal) abortSignal.addEventListener('abort', () => controller.abort())

  try {
    const events = query({
      prompt: message,
      options: {
        cwd: cwd ?? PROJECT_ROOT,
        resume: sessionId,
        settingSources: ['project', 'user'],
        permissionMode: 'bypassPermissions',
        maxTurns: maxTurns ?? AGENT_MAX_TURNS,
      },
    })

    for await (const event of events) {
      if (controller.signal.aborted) break

      const e = event as Record<string, unknown>

      if (e['type'] === 'system' && e['subtype'] === 'init') {
        newSessionId = (e['session_id'] as string) ?? undefined
      }

      if (e['type'] === 'result') {
        const result = e['result'] as Record<string, unknown> | undefined
        text = (result?.['result'] as string) ?? (e['result'] as string) ?? null
        const usage = result?.['usage'] as Record<string, number> | undefined
        inputTokens = usage?.['input_tokens'] ?? 0
        outputTokens = usage?.['output_tokens'] ?? 0
        model = result?.['model'] as string | undefined
      }
    }
  } finally {
    clearTimeout(timeoutId)
    if (typingInterval) clearInterval(typingInterval)
  }

  return { text, newSessionId, inputTokens, outputTokens, model }
}

export async function runAgentWithRetry(opts: AgentOptions, maxRetries = 2): Promise<AgentResult> {
  let lastErr: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await runAgent(opts)
      return result
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      const { recovery } = classifyError(lastErr)
      logger.warn({ attempt, err: lastErr.message, recovery }, 'agent error, classifying')

      if (!recovery.shouldRetry || attempt >= maxRetries) break

      if (recovery.shouldNewChat) {
        opts = { ...opts, sessionId: undefined }
      }

      if (recovery.retryAfterMs > 0) {
        await new Promise(r => setTimeout(r, recovery.retryAfterMs))
      }
    }
  }

  return { text: `Error: ${lastErr?.message ?? 'Unknown error'}` }
}

/**
 * Higher-level agent dispatch: handles session lookup, cwd resolution, and cost estimation.
 * This is the main entry point used by orchestrator, scheduler, bot, etc.
 */
export async function runAgentDispatch(opts: AgentDispatchOptions): Promise<AgentDispatchResult> {
  // Lazy imports to avoid circular deps at module load time
  const { getSession, setSession } = await import('./db.js')
  const { resolveAgentDir } = await import('./agent-config.js')
  const sessionId = getSession(opts.chatId, opts.agentId) ?? undefined
  const cwd = resolveAgentDir(opts.agentId)

  const result = await runAgentWithRetry({
    message: opts.message,
    sessionId,
    agentId: opts.agentId,
    cwd,
    abortSignal: opts.abortSignal,
  })

  if (result.newSessionId) {
    setSession(opts.chatId, result.newSessionId, opts.agentId)
  }

  const tokens = (result.inputTokens ?? 0) + (result.outputTokens ?? 0)
  const model = result.model ?? 'claude-sonnet-4-6'

  // Simple cost estimate: $3/1M input + $15/1M output for sonnet
  const costPerInputM = model.includes('opus') ? 15 : model.includes('haiku') ? 0.25 : 3
  const costPerOutputM = model.includes('opus') ? 75 : model.includes('haiku') ? 1.25 : 15
  const cost = ((result.inputTokens ?? 0) / 1_000_000) * costPerInputM +
               ((result.outputTokens ?? 0) / 1_000_000) * costPerOutputM

  return {
    result: result.text ?? '',
    tokens,
    cost,
    model,
    error: result.text?.startsWith('Error:') ? result.text : undefined,
  }
}
