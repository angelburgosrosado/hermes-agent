import crypto from 'crypto'
import { execSync } from 'child_process'
import { isSystemLocked, setLocked, touchActivity, getLastActivityAt } from './state.js'
import { logAuditEvent } from './db.js'
import { PIN_HASH, KILL_PHRASE } from './config.js'
import { logger } from './logger.js'


const SALT_SEP = ':'

// ---------- PIN management ----------

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + pin).digest('hex')
}

function loadStoredHash(): { salt: string; hash: string } | null {
  if (!PIN_HASH) return null
  const parts = PIN_HASH.split(SALT_SEP)
  if (parts.length !== 2) return null
  return { salt: parts[0]!, hash: parts[1]! }
}

export function initSecurity(): void {
  if (!PIN_HASH) {
    logger.warn('PIN_HASH not set — system lock disabled')
  }
  if (!KILL_PHRASE) {
    logger.warn('KILL_PHRASE not set — emergency kill disabled')
  }
}

export function isLocked(): boolean {
  return isSystemLocked()
}

/**
 * Attempt to unlock with a PIN. Returns true on success.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function unlock(pin: string, chatId: string): boolean {
  const stored = loadStoredHash()
  if (!stored) {
    // No PIN configured — always unlocked
    setLocked(false)
    return true
  }

  const attempt = hashPin(pin, stored.salt)
  const attemptBuf = Buffer.from(attempt, 'hex')
  const storedBuf = Buffer.from(stored.hash, 'hex')

  if (attemptBuf.length !== storedBuf.length) {
    audit('unlock_failed', chatId, 'PIN length mismatch')
    return false
  }

  const ok = crypto.timingSafeEqual(attemptBuf, storedBuf)
  if (ok) {
    setLocked(false)
    touchActivity()
    audit('unlock_success', chatId)
    logger.info({ chatId }, 'System unlocked')
  } else {
    audit('unlock_failed', chatId, 'Wrong PIN')
    logger.warn({ chatId }, 'Failed unlock attempt')
  }
  return ok
}

export function lock(chatId?: string): void {
  setLocked(true)
  audit('lock', chatId ?? 'system')
  logger.info({ chatId }, 'System locked')
}

// ---------- Kill phrase ----------

export function checkKillPhrase(text: string, chatId: string): boolean {
  if (!KILL_PHRASE) return false
  if (text.trim().toLowerCase() === KILL_PHRASE.trim().toLowerCase()) {
    audit('kill_phrase_triggered', chatId)
    logger.warn({ chatId }, 'Kill phrase triggered — executing emergency shutdown')
    executeEmergencyKill()
    return true
  }
  return false
}

export function executeEmergencyKill(): void {
  logger.error('EMERGENCY KILL INITIATED')
  audit('emergency_kill', 'system')

  // Terminate all claudeclaw processes
  try { execSync('pkill -f claudeclaw', { stdio: 'ignore' }) } catch { /* ignore */ }
  try { execSync('pkill -f "ts-node.*claudeclaw"', { stdio: 'ignore' }) } catch { /* ignore */ }

  // Kill this process after a short delay to flush logs
  setTimeout(() => process.exit(1), 500)
}

// ---------- Idle auto-lock ----------

let _idleTimer: NodeJS.Timeout | null = null

export function startIdleLockTimer(idleMs: number): void {
  stopIdleLockTimer()
  _idleTimer = setInterval(() => {
    const age = Date.now() - getLastActivityAt()
    if (age >= idleMs && !isSystemLocked()) {
      logger.info('Auto-locking due to idle timeout')
      lock('idle-timer')
    }
  }, 60_000)
}

export function stopIdleLockTimer(): void {
  if (_idleTimer) { clearInterval(_idleTimer); _idleTimer = null }
}

// ---------- Audit ----------

export function audit(action: string, chatId: string, detail?: string): void {
  try {
    logAuditEvent(action, detail, chatId)
  } catch (err) {
    logger.error({ err, action, chatId }, 'Audit log failed')
  }
}
