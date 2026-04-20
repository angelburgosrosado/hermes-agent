import { getAgentRegistry, AgentConfig } from './agent-config.js'
import { runAgentDispatch } from './agent.js'
import { buildMemoryContext } from './memory.js'
import { logger } from './logger.js'

export interface DelegationRequest {
  targetAgent: string
  task: string
  context?: string
  chatId: string
  fromAgent?: string
}

export interface DelegationResult {
  agentId: string
  result: string
  tokens: number
  cost: number
  error?: string
}

const DELEGATION_SYNTAX = /^@(\w[\w-]*)(?:\s+(.+))?$/s

/**
 * Parse "@agentName task description" delegation syntax.
 * Returns null if the message doesn't start with @agentName.
 */
export function parseDelegation(text: string): { agentId: string; task: string } | null {
  const trimmed = text.trim()
  const m = DELEGATION_SYNTAX.exec(trimmed)
  if (!m) return null
  return { agentId: m[1]!, task: (m[2] ?? '').trim() }
}

/**
 * Check if a message is a delegation request to a known agent.
 */
export function isDelegation(text: string): boolean {
  const parsed = parseDelegation(text)
  if (!parsed) return false
  const registry = getAgentRegistry()
  return registry.has(parsed.agentId)
}

/**
 * Execute a delegation to a sub-agent.
 * Injects relevant memory context and routes through runAgentWithRetry.
 */
export async function delegateToAgent(req: DelegationRequest): Promise<DelegationResult> {
  const registry = getAgentRegistry()
  const agentCfg = registry.get(req.targetAgent)

  if (!agentCfg) {
    const known = [...registry.keys()].join(', ')
    return {
      agentId: req.targetAgent,
      result: `Agent "${req.targetAgent}" not found. Available agents: ${known}`,
      tokens: 0,
      cost: 0,
      error: 'agent_not_found',
    }
  }

  logger.info({ targetAgent: req.targetAgent, chatId: req.chatId, from: req.fromAgent }, 'Delegating task')

  // Build memory context for the sub-agent
  const memCtx = await buildMemoryContext(req.chatId, req.task)

  const fullPrompt = [
    memCtx ? `## Memory Context\n${memCtx}\n` : '',
    req.context ? `## Context from orchestrator\n${req.context}\n` : '',
    `## Task\n${req.task}`,
  ].filter(Boolean).join('\n')

  const { result, tokens, cost, error } = await runAgentDispatch({
    chatId: req.chatId,
    agentId: req.targetAgent,
    message: fullPrompt,
  })

  return { agentId: req.targetAgent, result, tokens, cost, error }
}

/**
 * Route a message — if it's a @agent delegation, dispatch it.
 * Otherwise return null so the default handler processes it.
 */
export async function routeMessage(
  text: string,
  chatId: string,
  fromAgent?: string
): Promise<DelegationResult | null> {
  const parsed = parseDelegation(text)
  if (!parsed) return null

  const registry = getAgentRegistry()
  if (!registry.has(parsed.agentId)) return null

  return delegateToAgent({
    targetAgent: parsed.agentId,
    task: parsed.task || text,
    chatId,
    fromAgent,
  })
}

/**
 * List available agents with their descriptions.
 */
export function listAgents(): Array<{ id: string; name: string; description: string; model: string }> {
  const registry = getAgentRegistry()
  return [...registry.values()].map(a => ({
    id: a.id,
    name: a.name,
    description: a.description ?? '',
    model: a.model ?? 'default',
  }))
}
