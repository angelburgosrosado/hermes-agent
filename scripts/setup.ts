#!/usr/bin/env node
/**
 * ClaudeClaw OS Setup Script
 * Run once after cloning: npx tsx scripts/setup.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import crypto from 'crypto'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string, def?: string): Promise<string> =>
  new Promise(r => rl.question(def ? `${q} [${def}]: ` : `${q}: `, v => r(v.trim() || def || '')))

const STORE_DIR = path.join(PROJECT_ROOT, 'store')
const ENV_FILE = path.join(PROJECT_ROOT, '.env')

function generatePinHash(pin: string): string {
  const salt = crypto.randomBytes(8).toString('hex')
  const hash = crypto.createHash('sha256').update(salt + pin).digest('hex')
  return `${salt}:${hash}`
}

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════╗')
  console.log('║  ClaudeClaw OS Setup Wizard  ║')
  console.log('╚══════════════════════════════╝\n')

  // Create directories
  fs.mkdirSync(STORE_DIR, { recursive: true })
  fs.mkdirSync(path.join(PROJECT_ROOT, 'agents'), { recursive: true })
  console.log('✓ Store directory created')

  // .env setup
  const hasEnv = fs.existsSync(ENV_FILE)
  const envContent: Record<string, string> = {}

  if (hasEnv) {
    console.log('\n.env file already exists. Checking for missing keys…')
    const existing = fs.readFileSync(ENV_FILE, 'utf8')
    for (const line of existing.split('\n')) {
      const m = /^(\w+)=(.*)$/.exec(line.trim())
      if (m) envContent[m[1]!] = m[2]!
    }
  }

  console.log('\n── Required Keys ──\n')

  if (!envContent['ANTHROPIC_API_KEY']) {
    const key = await ask('Anthropic API key (sk-ant-...)')
    if (key) envContent['ANTHROPIC_API_KEY'] = key
  } else {
    console.log('✓ ANTHROPIC_API_KEY already set')
  }

  if (!envContent['TELEGRAM_BOT_TOKEN']) {
    const token = await ask('Telegram bot token (from @BotFather)')
    if (token) envContent['TELEGRAM_BOT_TOKEN'] = token
  } else {
    console.log('✓ TELEGRAM_BOT_TOKEN already set')
  }

  if (!envContent['GOOGLE_API_KEY'] && !envContent['GEMINI_API_KEY']) {
    const key = await ask('Google AI Studio API key (for memory embeddings, optional)', '')
    if (key) envContent['GOOGLE_API_KEY'] = key
  } else {
    console.log('✓ GOOGLE_API_KEY already set')
  }

  if (!envContent['GROQ_API_KEY']) {
    const key = await ask('Groq API key (for Whisper STT, optional)', '')
    if (key) envContent['GROQ_API_KEY'] = key
  } else {
    console.log('✓ GROQ_API_KEY already set')
  }

  console.log('\n── Security ──\n')
  if (!envContent['PIN_HASH']) {
    const pin = await ask('Security PIN (leave blank to skip)', '')
    if (pin) {
      envContent['PIN_HASH'] = generatePinHash(pin)
      console.log('✓ PIN hash generated')
    }
  } else {
    console.log('✓ PIN_HASH already set')
  }

  if (!envContent['DB_ENCRYPTION_KEY']) {
    envContent['DB_ENCRYPTION_KEY'] = crypto.randomBytes(32).toString('hex')
    console.log('✓ DB encryption key generated')
  }

  if (!envContent['DASHBOARD_TOKEN']) {
    envContent['DASHBOARD_TOKEN'] = crypto.randomBytes(16).toString('hex')
    console.log('✓ Dashboard token generated')
  }

  // Write .env
  const envLines = Object.entries(envContent)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  fs.writeFileSync(ENV_FILE, envLines + '\n')
  console.log('\n✓ .env file written')

  // Build
  console.log('\n── Building… ──\n')
  try {
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' })
    console.log('\n✓ Build successful')
  } catch {
    console.error('\n✗ Build failed — check errors above')
  }

  console.log('\n╔══════════════════════════════╗')
  console.log('║  Setup complete!             ║')
  console.log('╚══════════════════════════════╝')
  console.log('\nStart ClaudeClaw OS with: npm start\n')

  rl.close()
}

main().catch(err => { console.error(err); rl.close(); process.exit(1) })
