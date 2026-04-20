import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'url'
import { PROJECT_ROOT, CLAUDECLAW_CONFIG } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface AgentConfig {
  id: string
  name: string
  description: string
  model?: string
  telegramToken?: string
  cwd: string
  claudeMdPath: string
  mcpAllowlist?: string[]
  active?: boolean
}

const AGENT_ID_REGEX = /^[a-z][a-z0-9_-]{0,29}$/
const MAX_AGENTS = 20

let _registry: Map<string, AgentConfig> | null = null

function loadYaml(): AgentConfig[] {
  // Check external config first, then project root
  const locations = [
    path.join(CLAUDECLAW_CONFIG, 'agent.yaml'),
    path.join(PROJECT_ROOT, 'agent.yaml'),
  ]

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      const raw = yaml.load(fs.readFileSync(loc, 'utf-8')) as { agents?: AgentConfig[] }
      return (raw?.agents ?? []).slice(0, MAX_AGENTS)
    }
  }
  return []
}

export function loadAgentConfigs(): AgentConfig[] {
  const fromYaml = loadYaml()
  const configs: AgentConfig[] = []

  // Always include main
  const mainDir = PROJECT_ROOT
  const mainClaude = path.join(PROJECT_ROOT, 'CLAUDE.md')
  const mainFromYaml = fromYaml.find(a => a.id === 'main')
  configs.push(mainFromYaml ?? {
    id: 'main',
    name: 'Main',
    description: 'General-purpose assistant',
    model: 'claude-sonnet-4-6',
    cwd: mainDir,
    claudeMdPath: mainClaude,
    active: true,
  })

  // Add rest from yaml
  for (const a of fromYaml) {
    if (a.id === 'main') continue
    if (!AGENT_ID_REGEX.test(a.id)) continue
    configs.push({
      ...a,
      cwd: a.cwd ?? path.join(PROJECT_ROOT, 'agents', a.id),
      claudeMdPath: a.claudeMdPath ?? path.join(PROJECT_ROOT, 'agents', a.id, 'CLAUDE.md'),
    })
  }

  return configs
}

export function initOrchestrator(): void {
  const configs = loadAgentConfigs()
  _registry = new Map(configs.map(c => [c.id, c]))
}

export function getAgentRegistry(): Map<string, AgentConfig> {
  if (!_registry) initOrchestrator()
  return _registry!
}

export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return getAgentRegistry().get(agentId)
}

export function getDefaultAgent(): AgentConfig {
  return getAgentRegistry().get('main') ?? loadAgentConfigs()[0]
}

export function resolveAgentDir(agentId: string): string {
  return getAgentConfig(agentId)?.cwd ?? path.join(PROJECT_ROOT, 'agents', agentId)
}

export function resolveAgentClaudeMd(agentId: string): string {
  return getAgentConfig(agentId)?.claudeMdPath ?? path.join(PROJECT_ROOT, 'agents', agentId, 'CLAUDE.md')
}
