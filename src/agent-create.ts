import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { PROJECT_ROOT } from './config.js'
import { logger } from './logger.js'

export interface AgentCreateOptions {
  id: string
  name: string
  description: string
  model?: string
  systemPrompt?: string
  tools?: string[]
  maxTurns?: number
  timeoutMs?: number
  telegramToken?: string
}

export interface AgentCreateResult {
  success: boolean
  agentDir: string
  message: string
}

const AGENTS_DIR = path.join(PROJECT_ROOT, 'agents')
const AGENT_YAML = path.join(PROJECT_ROOT, 'agent.yaml')
const ALLOWED_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'TodoWrite', 'Agent',
]

// ---------- Validation ----------

export function validateAgentId(id: string): string | null {
  if (!id) return 'Agent ID is required'
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(id)) return 'Agent ID must be lowercase alphanumeric with hyphens, starting with a letter'
  return null
}

export function validateAgentOptions(opts: Partial<AgentCreateOptions>): string[] {
  const errors: string[] = []
  if (!opts.id) errors.push('id is required')
  else {
    const idErr = validateAgentId(opts.id)
    if (idErr) errors.push(idErr)
  }
  if (!opts.name) errors.push('name is required')
  if (!opts.description) errors.push('description is required')
  if (opts.tools) {
    const invalid = opts.tools.filter(t => !ALLOWED_TOOLS.includes(t))
    if (invalid.length) errors.push(`Unknown tools: ${invalid.join(', ')}. Allowed: ${ALLOWED_TOOLS.join(', ')}`)
  }
  return errors
}

// ---------- File generation ----------

function generateClaudeMd(opts: AgentCreateOptions): string {
  return `# ${opts.name}

${opts.description}

## Persona
You are ${opts.name}. ${opts.systemPrompt ?? `Your role: ${opts.description}`}

## Guidelines
- Stay focused on your assigned tasks
- Ask for clarification when requirements are ambiguous
- Report blockers promptly
- Keep responses concise and actionable
`
}

function generateSystemPrompt(opts: AgentCreateOptions): string {
  return opts.systemPrompt ?? `You are ${opts.name}. ${opts.description}`
}

// ---------- YAML update ----------

interface AgentYamlEntry {
  id: string
  name: string
  description: string
  model?: string
  max_turns?: number
  timeout_ms?: number
  telegram_token?: string
  tools?: string[]
}

async function appendToAgentYaml(opts: AgentCreateOptions): Promise<void> {
  let doc: { agents?: AgentYamlEntry[] } = {}

  if (fs.existsSync(AGENT_YAML)) {
    const raw = fs.readFileSync(AGENT_YAML, 'utf8')
    doc = (yaml.load(raw) as typeof doc) ?? {}
  }

  if (!doc.agents) doc.agents = []

  // Remove existing entry with same ID
  doc.agents = doc.agents.filter(a => a.id !== opts.id)

  const entry: AgentYamlEntry = {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.maxTurns ? { max_turns: opts.maxTurns } : {}),
    ...(opts.timeoutMs ? { timeout_ms: opts.timeoutMs } : {}),
    ...(opts.telegramToken ? { telegram_token: opts.telegramToken } : {}),
    ...(opts.tools?.length ? { tools: opts.tools } : {}),
  }

  doc.agents.push(entry)
  fs.writeFileSync(AGENT_YAML, yaml.dump(doc, { indent: 2 }))
  logger.info({ agentId: opts.id }, 'Updated agent.yaml')
}

// ---------- Main creation function ----------

export async function createAgent(opts: AgentCreateOptions): Promise<AgentCreateResult> {
  const errors = validateAgentOptions(opts)
  if (errors.length) {
    return { success: false, agentDir: '', message: errors.join('; ') }
  }

  const agentDir = path.join(AGENTS_DIR, opts.id)

  try {
    fs.mkdirSync(agentDir, { recursive: true })

    // CLAUDE.md
    fs.writeFileSync(path.join(agentDir, 'CLAUDE.md'), generateClaudeMd(opts))

    // system_prompt.txt (used by agent runner)
    fs.writeFileSync(path.join(agentDir, 'system_prompt.txt'), generateSystemPrompt(opts))

    // Update agent.yaml
    await appendToAgentYaml(opts)

    logger.info({ agentId: opts.id, agentDir }, 'Agent created successfully')
    return {
      success: true,
      agentDir,
      message: `Agent "${opts.name}" (${opts.id}) created at ${agentDir}`,
    }
  } catch (err) {
    logger.error({ err, agentId: opts.id }, 'Failed to create agent')
    return {
      success: false,
      agentDir,
      message: `Failed to create agent: ${(err as Error).message}`,
    }
  }
}

export async function deleteAgent(agentId: string): Promise<{ success: boolean; message: string }> {
  const idErr = validateAgentId(agentId)
  if (idErr) return { success: false, message: idErr }

  const agentDir = path.join(AGENTS_DIR, agentId)

  // Remove from agent.yaml
  if (fs.existsSync(AGENT_YAML)) {
    const raw = fs.readFileSync(AGENT_YAML, 'utf8')
    const doc = (yaml.load(raw) as { agents?: AgentYamlEntry[] }) ?? {}
    if (doc.agents) {
      doc.agents = doc.agents.filter(a => a.id !== agentId)
      fs.writeFileSync(AGENT_YAML, yaml.dump(doc, { indent: 2 }))
    }
  }

  // Remove directory
  if (fs.existsSync(agentDir)) {
    fs.rmSync(agentDir, { recursive: true, force: true })
  }

  return { success: true, message: `Agent "${agentId}" removed` }
}

export function listExistingAgents(): AgentYamlEntry[] {
  if (!fs.existsSync(AGENT_YAML)) return []
  const raw = fs.readFileSync(AGENT_YAML, 'utf8')
  const doc = (yaml.load(raw) as { agents?: AgentYamlEntry[] }) ?? {}
  return doc.agents ?? []
}
