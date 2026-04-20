import { logTokenUsage, getTokenStats } from './db.js'

interface UsageBucket { tokens: number; cost: number; ts: number }

const _hourly = new Map<string, UsageBucket[]>()
const DAILY_TOKEN_LIMIT = parseInt(process.env['DAILY_TOKEN_LIMIT'] ?? '5000000')
const HOURLY_TOKEN_LIMIT = parseInt(process.env['HOURLY_TOKEN_LIMIT'] ?? '1000000')

export function trackUsage(chatId: string, agentId: string, tokens: number, cost: number, model = 'unknown'): void {
  logTokenUsage(chatId, agentId, model, tokens, 0, cost)
  const key = `${chatId}:${agentId}`
  const buckets = _hourly.get(key) ?? []
  buckets.push({ tokens, cost, ts: Date.now() })
  _hourly.set(key, buckets)
}

export function getDailyUsage(chatId?: string): { tokens: number; cost: number } {
  const stats = getTokenStats(chatId)
  return { tokens: stats.total_input + stats.total_output, cost: stats.total_cost }
}

export function getHourlyUsage(chatId?: string): { tokens: number; cost: number } {
  const cutoff = Date.now() - 3600000
  let tokens = 0, cost = 0
  for (const [key, buckets] of _hourly) {
    if (chatId && !key.startsWith(chatId + ':')) continue
    for (const b of buckets) {
      if (b.ts >= cutoff) { tokens += b.tokens; cost += b.cost }
    }
  }
  return { tokens, cost }
}

export function isOverBudget(chatId?: string): boolean {
  const daily = getDailyUsage(chatId)
  const hourly = getHourlyUsage(chatId)
  return daily.tokens > DAILY_TOKEN_LIMIT || hourly.tokens > HOURLY_TOKEN_LIMIT
}

// Prune old hourly buckets every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 3600000
  for (const [key, buckets] of _hourly) {
    const fresh = buckets.filter(b => b.ts >= cutoff)
    if (fresh.length === 0) _hourly.delete(key)
    else _hourly.set(key, fresh)
  }
}, 600000)
