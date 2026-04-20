#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
import { logger } from './logger.js'
import { initSecurity, startIdleLockTimer } from './security.js'
import { startConsolidationLoop } from './memory-consolidate.js'
import { startScheduler, stopScheduler } from './scheduler.js'
import { startDashboard, stopDashboard } from './dashboard.js'
import { startWhatsApp, stopWhatsApp } from './whatsapp.js'
import { startBot, stopBot } from './bot.js'
import {
  PROJECT_ROOT, IDLE_LOCK_MINUTES, DASHBOARD_PORT,
  TELEGRAM_BOT_TOKEN, WHATSAPP_ALLOWED_USERS, WARROOM_PORT,
} from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PID_FILE = path.join(PROJECT_ROOT, 'store', 'claudeclaw.pid')

// ── War Room subprocess ───────────────────────────────────────────────────────

let _warroomProc: ChildProcess | null = null

function startWarRoom(): void {
  const warroomDir = path.join(PROJECT_ROOT, 'warroom')
  if (!fs.existsSync(path.join(warroomDir, 'server.py'))) {
    logger.warn('War Room server.py not found — skipping')
    return
  }

  function spawn_proc(): void {
    _warroomProc = spawn('python', ['-m', 'warroom.server'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    _warroomProc.stdout?.on('data', (d: Buffer) => logger.debug({ src: 'warroom' }, d.toString().trim()))
    _warroomProc.stderr?.on('data', (d: Buffer) => logger.debug({ src: 'warroom' }, d.toString().trim()))

    _warroomProc.on('exit', (code, signal) => {
      logger.warn({ code, signal }, 'War Room exited — restarting in 5s')
      _warroomProc = null
      setTimeout(spawn_proc, 5000)
    })

    logger.info({ port: WARROOM_PORT }, 'War Room started')
  }

  spawn_proc()
}

function stopWarRoom(): void {
  if (_warroomProc) {
    _warroomProc.removeAllListeners('exit')
    _warroomProc.kill('SIGTERM')
    _warroomProc = null
  }
}

// ── PID lock ──────────────────────────────────────────────────────────────────

function acquirePidLock(): void {
  const storeDir = path.join(PROJECT_ROOT, 'store')
  fs.mkdirSync(storeDir, { recursive: true })

  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim())
    if (!isNaN(oldPid)) {
      try {
        process.kill(oldPid, 0) // check if alive
        logger.error({ oldPid }, 'Another ClaudeClaw instance is running. Exiting.')
        process.exit(1)
      } catch {
        // Process dead — stale PID file, remove it
        fs.unlinkSync(PID_FILE)
      }
    }
  }

  fs.writeFileSync(PID_FILE, String(process.pid))
}

function releasePidLock(): void {
  try { fs.unlinkSync(PID_FILE) } catch { /* ignore */ }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // PID lock
  acquirePidLock()

  logger.info({ pid: process.pid }, 'ClaudeClaw OS starting')

  // Database
  initDatabase()
  logger.info('Database initialized')

  // Security
  initSecurity()
  if (IDLE_LOCK_MINUTES > 0) {
    startIdleLockTimer(IDLE_LOCK_MINUTES * 60_000)
    logger.info({ idleMinutes: IDLE_LOCK_MINUTES }, 'Idle lock timer started')
  }

  // Memory consolidation loop (runs for all chats — pass a global marker)
  startConsolidationLoop('*')
  logger.info('Memory consolidation loop started')

  // Scheduler
  startScheduler()

  // Dashboard
  startDashboard()

  // War Room voice server (Python subprocess, optional)
  if (process.env['WARROOM_ENABLED'] === 'true') {
    logger.info('Starting War Room…')
    startWarRoom()
  }

  // WhatsApp bridge
  if (WHATSAPP_ALLOWED_USERS) {
    logger.info('Starting WhatsApp bridge…')
    startWhatsApp().catch(err => logger.error({ err }, 'WhatsApp bridge failed to start'))
  }

  // Telegram bot (main service)
  if (TELEGRAM_BOT_TOKEN) {
    startBot().catch(err => {
      logger.error({ err }, 'Telegram bot crashed')
      process.exit(1)
    })
  } else {
    logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled')
  }

  logger.info('ClaudeClaw OS ready')
  console.log('\n  ⚡ ClaudeClaw OS is running\n')
  console.log(`  Dashboard: http://localhost:${DASHBOARD_PORT}`)
  console.log('  Press Ctrl+C to stop\n')
}

// ── Shutdown ──────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down…')

  stopScheduler()
  stopDashboard()
  stopWarRoom()

  try { await stopBot() } catch { /* ignore */ }
  try { await stopWhatsApp() } catch { /* ignore */ }

  releasePidLock()
  logger.info('Goodbye.')
  process.exit(0)
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception')
  shutdown('uncaughtException').catch(() => process.exit(1))
})
process.once('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection')
})

main().catch(err => {
  logger.error({ err }, 'Fatal startup error')
  releasePidLock()
  process.exit(1)
})
