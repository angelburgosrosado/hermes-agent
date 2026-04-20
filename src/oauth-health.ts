import https from 'https'
import http from 'http'
import { logger } from './logger.js'
import {
  ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY,
  DEEPGRAM_API_KEY, CARTESIA_API_KEY, ELEVENLABS_API_KEY,
  TELEGRAM_BOT_TOKEN, WHATSAPP_ALLOWED_USERS, WARROOM_PORT,
} from './config.js'

export type ServiceCategory = 'llm' | 'voice' | 'messaging' | 'local' | 'infrastructure'

export interface ServiceHealth {
  service: string
  category: ServiceCategory
  configured: boolean
  reachable?: boolean
  error?: string
  latencyMs?: number
  meta?: Record<string, unknown>
}

async function ping(hostname: string, path: string, headers: Record<string, string>): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  return new Promise((resolve) => {
    const req = https.request({ hostname, path, method: 'GET', headers, timeout: 5000 }, (res) => {
      res.resume()
      resolve({ ok: res.statusCode !== undefined && res.statusCode < 500, latencyMs: Date.now() - start })
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latencyMs: Date.now() - start, error: 'timeout' }) })
    req.on('error', (err) => resolve({ ok: false, latencyMs: Date.now() - start, error: err.message }))
    req.end()
  })
}

async function pingLocal(port: number, path: string): Promise<{ ok: boolean; latencyMs: number; error?: string; body?: string }> {
  const start = Date.now()
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port, path, timeout: 3000 }, (res) => {
      let body = ''
      res.on('data', (d: Buffer) => { body += d.toString() })
      res.on('end', () => resolve({ ok: res.statusCode !== undefined && res.statusCode < 500, latencyMs: Date.now() - start, body }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latencyMs: Date.now() - start, error: 'timeout' }) })
    req.on('error', (err) => resolve({ ok: false, latencyMs: Date.now() - start, error: err.message }))
  })
}

export async function checkOAuthHealth(): Promise<ServiceHealth[]> {
  const results: ServiceHealth[] = []

  // ── LLM ──────────────────────────────────────────────────────────────────
  if (ANTHROPIC_API_KEY) {
    const r = await ping('api.anthropic.com', '/v1/models', { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' })
    results.push({ service: 'Anthropic', category: 'llm', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'Anthropic', category: 'llm', configured: false })
  }

  if (GOOGLE_API_KEY) {
    const r = await ping('generativelanguage.googleapis.com', `/v1beta/models?key=${GOOGLE_API_KEY}`, {})
    results.push({ service: 'Google Gemini', category: 'llm', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'Google Gemini', category: 'llm', configured: false })
  }

  if (GROQ_API_KEY) {
    const r = await ping('api.groq.com', '/openai/v1/models', { 'Authorization': `Bearer ${GROQ_API_KEY}` })
    results.push({ service: 'Groq', category: 'llm', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'Groq', category: 'llm', configured: false })
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  if (DEEPGRAM_API_KEY) {
    const r = await ping('api.deepgram.com', '/v1/projects', { 'Authorization': `Token ${DEEPGRAM_API_KEY}` })
    results.push({ service: 'Deepgram', category: 'voice', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'Deepgram', category: 'voice', configured: false })
  }

  if (CARTESIA_API_KEY) {
    const r = await ping('api.cartesia.ai', '/voices', { 'X-API-Key': CARTESIA_API_KEY })
    results.push({ service: 'Cartesia', category: 'voice', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'Cartesia', category: 'voice', configured: false })
  }

  if (ELEVENLABS_API_KEY) {
    const r = await ping('api.elevenlabs.io', '/v1/user', { 'xi-api-key': ELEVENLABS_API_KEY })
    results.push({ service: 'ElevenLabs', category: 'voice', configured: true, reachable: r.ok, latencyMs: r.latencyMs, error: r.error })
  } else {
    results.push({ service: 'ElevenLabs', category: 'voice', configured: false })
  }

  // ── Infrastructure ────────────────────────────────────────────────────────
  const warroom = await pingLocal(WARROOM_PORT, '/health')
  if (warroom.ok && warroom.body) {
    try {
      const wr = JSON.parse(warroom.body)
      results.push({
        service: 'War Room',
        category: 'infrastructure',
        configured: true,
        reachable: true,
        latencyMs: warroom.latencyMs,
        meta: { mode: wr.mode, pipecat: wr.pipecat, gemini_live: wr.gemini_live, port: WARROOM_PORT },
      })
    } catch {
      results.push({ service: 'War Room', category: 'infrastructure', configured: true, reachable: true, latencyMs: warroom.latencyMs })
    }
  } else {
    results.push({ service: 'War Room', category: 'infrastructure', configured: true, reachable: false, error: warroom.error ?? 'unreachable', latencyMs: warroom.latencyMs })
  }

  // ── Messaging ─────────────────────────────────────────────────────────────
  results.push({
    service: 'Telegram Bot',
    category: 'messaging',
    configured: !!TELEGRAM_BOT_TOKEN,
  })

  results.push({
    service: 'WhatsApp',
    category: 'messaging',
    configured: !!WHATSAPP_ALLOWED_USERS,
  })

  return results
}

export function formatHealthReport(results: ServiceHealth[]): string {
  return results.map(r => {
    if (!r.configured) return `○ ${r.service.padEnd(16)} not configured`
    const status = r.reachable ? '✓' : '✗'
    const latency = r.latencyMs !== undefined ? `${r.latencyMs}ms` : ''
    const err = r.error ? ` (${r.error})` : ''
    return `${status} ${r.service.padEnd(16)} ${latency}${err}`
  }).join('\n')
}
