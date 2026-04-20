import { fileURLToPath } from 'url'
import path from 'path'
import { readEnvFile } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PROJECT_ROOT = path.resolve(__dirname, '..')
export const STORE_DIR = path.join(PROJECT_ROOT, 'store')

const env = readEnvFile()

// Core
export const TELEGRAM_BOT_TOKEN = env['TELEGRAM_BOT_TOKEN'] ?? ''
export const ALLOWED_CHAT_ID = env['ALLOWED_CHAT_ID'] ?? ''
export const TELEGRAM_ALLOWED_USERS = env['TELEGRAM_ALLOWED_USERS'] ?? ''

// Voice
export const GROQ_API_KEY = env['GROQ_API_KEY'] ?? ''
export const ELEVENLABS_API_KEY = env['ELEVENLABS_API_KEY'] ?? ''
export const ELEVENLABS_VOICE_ID = env['ELEVENLABS_VOICE_ID'] ?? ''
export const KOKORO_URL = env['KOKORO_URL'] ?? ''
export const STT_GROQ_MODEL = env['STT_GROQ_MODEL'] ?? 'whisper-large-v3-turbo'

// LLM
export const ANTHROPIC_API_KEY = env['ANTHROPIC_API_KEY'] ?? ''
export const OPENROUTER_API_KEY = env['OPENROUTER_API_KEY'] ?? ''
export const GOOGLE_API_KEY = env['GOOGLE_API_KEY'] ?? env['GEMINI_API_KEY'] ?? ''

// War Room
export const DEEPGRAM_API_KEY = env['DEEPGRAM_API_KEY'] ?? ''
export const CARTESIA_API_KEY = env['CARTESIA_API_KEY'] ?? ''
export const WARROOM_MODE = env['WARROOM_MODE'] ?? 'legacy'
export const WARROOM_PORT = parseInt(env['WARROOM_PORT'] ?? '7860')

// Security
export const PIN_HASH = env['PIN_HASH'] ?? ''
export const IDLE_LOCK_MINUTES = parseInt(env['IDLE_LOCK_MINUTES'] ?? '30')
export const KILL_PHRASE = env['KILL_PHRASE'] ?? ''

// Dashboard
export const DASHBOARD_PORT = parseInt(env['DASHBOARD_PORT'] ?? '3141')
export const DASHBOARD_TOKEN = env['DASHBOARD_TOKEN'] ?? ''

// Multi-agent
export const CLAUDECLAW_CONFIG = env['CLAUDECLAW_CONFIG'] ?? path.join(process.env['HOME'] ?? '~', '.claudeclaw')
export const COMMS_TELEGRAM_TOKEN = env['COMMS_TELEGRAM_TOKEN'] ?? ''
export const CONTENT_TELEGRAM_TOKEN = env['CONTENT_TELEGRAM_TOKEN'] ?? ''
export const OPS_TELEGRAM_TOKEN = env['OPS_TELEGRAM_TOKEN'] ?? ''
export const RESEARCH_TELEGRAM_TOKEN = env['RESEARCH_TELEGRAM_TOKEN'] ?? ''

// Meeting bot
export const PIKA_API_KEY = env['PIKA_API_KEY'] ?? ''
export const RECALL_API_KEY = env['RECALL_API_KEY'] ?? ''

// Slack
export const SLACK_BOT_TOKEN = env['SLACK_BOT_TOKEN'] ?? ''

// WhatsApp
export const WHATSAPP_ALLOWED_USERS = env['WHATSAPP_ALLOWED_USERS'] ?? ''

// Agent behavior
export const AGENT_TIMEOUT_MS = parseInt(env['AGENT_TIMEOUT_MS'] ?? '900000')
export const AGENT_MAX_TURNS = parseInt(env['AGENT_MAX_TURNS'] ?? '30')
export const SHOW_COST_FOOTER = (env['SHOW_COST_FOOTER'] ?? 'compact') as 'compact' | 'verbose' | 'cost' | 'full' | 'off'
export const STREAM_STRATEGY = (env['STREAM_STRATEGY'] ?? 'off') as 'global-throttle' | 'single-agent-only' | 'off'
export const MEMORY_NUDGE_INTERVAL_TURNS = parseInt(env['MEMORY_NUDGE_INTERVAL_TURNS'] ?? '10')
export const MEMORY_NUDGE_INTERVAL_HOURS = parseInt(env['MEMORY_NUDGE_INTERVAL_HOURS'] ?? '2')
export const CONSOLIDATION_INTERVAL_MS = 30 * 60 * 1000
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000

// System
export const LOG_LEVEL = env['LOG_LEVEL'] ?? 'info'

export interface AgentOverrides {
  model?: string
  timeoutMs?: number
  maxTurns?: number
}

let _agentOverrides: AgentOverrides = {}

export function setAgentOverrides(overrides: Partial<AgentOverrides>): void {
  _agentOverrides = { ..._agentOverrides, ...overrides }
}

export function getAgentOverrides(): AgentOverrides {
  return _agentOverrides
}
