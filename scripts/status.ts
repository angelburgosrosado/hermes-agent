#!/usr/bin/env node
/**
 * Show ClaudeClaw OS status without starting the bot.
 * Usage: npx tsx scripts/status.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const PID_FILE = path.join(PROJECT_ROOT, 'store', 'claudeclaw.pid')
const ENV_FILE = path.join(PROJECT_ROOT, '.env')
const DB_FILE = path.join(PROJECT_ROOT, 'store', 'claudeclaw.db')
const AGENT_YAML = path.join(PROJECT_ROOT, 'agent.yaml')
const DIST_DIR = path.join(PROJECT_ROOT, 'dist')

function check(label: string, condition: boolean, hint?: string): void {
  const icon = condition ? '✓' : '✗'
  const color = condition ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'
  console.log(`  ${color}${icon}${reset} ${label}${hint && !condition ? `  → ${hint}` : ''}`)
}

function isRunning(): boolean {
  if (!fs.existsSync(PID_FILE)) return false
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim())
  if (isNaN(pid)) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

function envHas(key: string): boolean {
  if (!fs.existsSync(ENV_FILE)) return false
  const content = fs.readFileSync(ENV_FILE, 'utf8')
  return new RegExp(`^${key}=.+`, 'm').test(content)
}

async function main(): Promise<void> {
  console.log('\n⚡ ClaudeClaw OS Status\n')

  console.log('Runtime:')
  check('Process running', isRunning(), 'run: npm start')
  check('Build exists', fs.existsSync(DIST_DIR), 'run: npm run build')
  check('Database exists', fs.existsSync(DB_FILE))

  console.log('\nConfiguration:')
  check('.env file', fs.existsSync(ENV_FILE), 'run: npm run setup or copy .env.example')
  check('agent.yaml', fs.existsSync(AGENT_YAML), 'run: npm run setup')

  console.log('\nAPI Keys:')
  check('ANTHROPIC_API_KEY', envHas('ANTHROPIC_API_KEY'), 'required')
  check('TELEGRAM_BOT_TOKEN', envHas('TELEGRAM_BOT_TOKEN'), 'required for bot')
  check('GOOGLE_API_KEY', envHas('GOOGLE_API_KEY'), 'optional, enables memory v2')
  check('GROQ_API_KEY', envHas('GROQ_API_KEY'), 'optional, enables voice STT')
  check('DEEPGRAM_API_KEY', envHas('DEEPGRAM_API_KEY'), 'optional, enables war room')
  check('CARTESIA_API_KEY', envHas('CARTESIA_API_KEY'), 'optional, enables war room TTS')

  console.log('\nAgents:')
  if (fs.existsSync(AGENT_YAML)) {
    const { load } = await import('js-yaml')
    const doc = load(fs.readFileSync(AGENT_YAML, 'utf8')) as { agents?: { id: string; name: string }[] }
    const agents = doc.agents ?? []
    for (const a of agents) {
      const hasDir = fs.existsSync(path.join(PROJECT_ROOT, 'agents', a.id))
      check(`${a.id} (${a.name})`, hasDir, `mkdir agents/${a.id}`)
    }
  }

  const running = isRunning()
  if (running) {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim()
    console.log(`\n  Process: PID ${pid}`)
  }

  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
