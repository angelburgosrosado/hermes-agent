/**
 * usage-tracker.ts — reads ~/.claude/usage.db populated by usage/scanner.py
 * and exposes cost/token stats for the ClaudeClaw OS dashboard.
 *
 * Pricing: Anthropic API, April 2026 (per million tokens)
 */

import Database from 'better-sqlite3'
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const USAGE_DB_PATH = path.join(os.homedir(), '.claude', 'usage.db')
const SCANNER_PATH = path.join(__dirname, '..', 'usage', 'scanner.py')

// ── Pricing table (per million tokens) ────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number; cache_write: number; cache_read: number }> = {
  'claude-opus-4-6':   { input: 5.00, output: 25.00, cache_write: 6.25, cache_read: 0.50 },
  'claude-opus-4-5':   { input: 5.00, output: 25.00, cache_write: 6.25, cache_read: 0.50 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cache_write: 3.75, cache_read: 0.30 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cache_write: 3.75, cache_read: 0.30 },
  'claude-haiku-4-5':  { input: 1.00, output:  5.00, cache_write: 1.25, cache_read: 0.10 },
  'claude-haiku-4-6':  { input: 1.00, output:  5.00, cache_write: 1.25, cache_read: 0.10 },
}

function getPricing(model: string) {
  if (!model) return null
  if (PRICING[model]) return PRICING[model]
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key]
  }
  const m = model.toLowerCase()
  if (m.includes('opus'))   return PRICING['claude-opus-4-6']
  if (m.includes('sonnet')) return PRICING['claude-sonnet-4-6']
  if (m.includes('haiku'))  return PRICING['claude-haiku-4-5']
  return null
}

export function calcCost(model: string, inp: number, out: number, cacheRead: number, cacheCreation: number): number {
  const p = getPricing(model)
  if (!p) return 0
  return (
    inp          * p.input       / 1e6 +
    out          * p.output      / 1e6 +
    cacheRead    * p.cache_read  / 1e6 +
    cacheCreation * p.cache_write / 1e6
  )
}

// ── Scanner trigger ────────────────────────────────────────────────────────────

export function triggerScan(): { ok: boolean; message: string } {
  if (!existsSync(SCANNER_PATH)) {
    return { ok: false, message: `Scanner not found at ${SCANNER_PATH}` }
  }
  const result = spawnSync('python3', [SCANNER_PATH], {
    encoding: 'utf8',
    timeout: 120_000,
  })
  if (result.status !== 0) {
    return { ok: false, message: (result.stderr ?? '').slice(0, 400) || 'scan failed' }
  }
  return { ok: true, message: (result.stdout ?? '').trim() || 'scan complete' }
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

function openUsageDb(): Database.Database | null {
  if (!existsSync(USAGE_DB_PATH)) return null
  try {
    return new Database(USAGE_DB_PATH, { readonly: true })
  } catch {
    return null
  }
}

// ── Main query ─────────────────────────────────────────────────────────────────

export interface UsageStats {
  allModels: string[]
  dailyByModel: DailyRow[]
  sessions: SessionRow[]
  totals: TotalsRow
  generatedAt: string
}

export interface DailyRow {
  day: string
  model: string
  input: number
  output: number
  cache_read: number
  cache_creation: number
  turns: number
  cost: number
}

export interface SessionRow {
  session_id: string
  project: string
  last: string
  last_date: string
  duration_min: number
  model: string
  turns: number
  input: number
  output: number
  cache_read: number
  cache_creation: number
  cost: number
}

export interface TotalsRow {
  totalCost: number
  totalInput: number
  totalOutput: number
  totalCacheRead: number
  totalCacheCreation: number
  totalTurns: number
  totalSessions: number
  todayCost: number
  todayTokens: number
  firstDate: string
  lastDate: string
}

export function getUsageStats(): UsageStats | null {
  const db = openUsageDb()
  if (!db) return null

  try {
    // All models
    const allModels: string[] = (db.prepare(`
      SELECT COALESCE(model, 'unknown') as model
      FROM turns
      GROUP BY model
      ORDER BY SUM(input_tokens + output_tokens) DESC
    `).all() as any[]).map((r: any) => r.model)

    // Daily per-model (all history — client filters by range)
    const dailyRows: any[] = db.prepare(`
      SELECT
        substr(timestamp, 1, 10)    as day,
        COALESCE(model, 'unknown')  as model,
        SUM(input_tokens)           as input,
        SUM(output_tokens)          as output,
        SUM(cache_read_tokens)      as cache_read,
        SUM(cache_creation_tokens)  as cache_creation,
        COUNT(*)                    as turns
      FROM turns
      GROUP BY day, model
      ORDER BY day, model
    `).all() as any[]

    const dailyByModel: DailyRow[] = dailyRows.map((r: any) => ({
      day:           r.day,
      model:         r.model,
      input:         r.input || 0,
      output:        r.output || 0,
      cache_read:    r.cache_read || 0,
      cache_creation: r.cache_creation || 0,
      turns:         r.turns || 0,
      cost: calcCost(r.model, r.input || 0, r.output || 0, r.cache_read || 0, r.cache_creation || 0),
    }))

    // Sessions (most recent 200)
    const sessionRows: any[] = db.prepare(`
      SELECT
        session_id, project_name, first_timestamp, last_timestamp,
        total_input_tokens, total_output_tokens,
        total_cache_read, total_cache_creation, model, turn_count
      FROM sessions
      ORDER BY last_timestamp DESC
      LIMIT 200
    `).all() as any[]

    const sessions: SessionRow[] = sessionRows.map((r: any) => {
      let durationMin = 0
      try {
        const t1 = new Date(r.first_timestamp).getTime()
        const t2 = new Date(r.last_timestamp).getTime()
        durationMin = Math.round((t2 - t1) / 60_000 * 10) / 10
      } catch { /* ignore */ }
      const inp = r.total_input_tokens || 0
      const out = r.total_output_tokens || 0
      const cr  = r.total_cache_read || 0
      const cc  = r.total_cache_creation || 0
      return {
        session_id:    (r.session_id || '').slice(0, 8),
        project:       r.project_name || 'unknown',
        last:          (r.last_timestamp || '').slice(0, 16).replace('T', ' '),
        last_date:     (r.last_timestamp || '').slice(0, 10),
        duration_min:  durationMin,
        model:         r.model || 'unknown',
        turns:         r.turn_count || 0,
        input: inp, output: out, cache_read: cr, cache_creation: cc,
        cost: calcCost(r.model || '', inp, out, cr, cc),
      }
    })

    // All-time totals
    const totalsRow: any = db.prepare(`
      SELECT
        SUM(input_tokens)           as inp,
        SUM(output_tokens)          as out,
        SUM(cache_read_tokens)      as cr,
        SUM(cache_creation_tokens)  as cc,
        COUNT(*)                    as turns
      FROM turns
    `).get() as any

    const sessCount: any = db.prepare(`SELECT COUNT(*) as cnt, MIN(first_timestamp) as first, MAX(last_timestamp) as last FROM sessions`).get() as any

    // Today's usage
    const today = new Date().toISOString().slice(0, 10)
    const todayRows: any[] = db.prepare(`
      SELECT COALESCE(model,'unknown') as model,
        SUM(input_tokens) as inp, SUM(output_tokens) as out,
        SUM(cache_read_tokens) as cr, SUM(cache_creation_tokens) as cc
      FROM turns WHERE substr(timestamp,1,10) = ?
      GROUP BY model
    `).all(today) as any[]

    let todayCost = 0
    let todayTokens = 0
    for (const r of todayRows) {
      todayCost += calcCost(r.model, r.inp || 0, r.out || 0, r.cr || 0, r.cc || 0)
      todayTokens += (r.inp || 0) + (r.out || 0)
    }

    // Total cost across all models using per-model pricing
    const modelTotals: any[] = db.prepare(`
      SELECT COALESCE(model,'unknown') as model,
        SUM(input_tokens) as inp, SUM(output_tokens) as out,
        SUM(cache_read_tokens) as cr, SUM(cache_creation_tokens) as cc
      FROM turns GROUP BY model
    `).all() as any[]

    let totalCost = 0
    for (const r of modelTotals) {
      totalCost += calcCost(r.model, r.inp || 0, r.out || 0, r.cr || 0, r.cc || 0)
    }

    const totals: TotalsRow = {
      totalCost,
      totalInput:        totalsRow?.inp || 0,
      totalOutput:       totalsRow?.out || 0,
      totalCacheRead:    totalsRow?.cr  || 0,
      totalCacheCreation: totalsRow?.cc || 0,
      totalTurns:        totalsRow?.turns || 0,
      totalSessions:     sessCount?.cnt || 0,
      todayCost,
      todayTokens,
      firstDate: (sessCount?.first || '').slice(0, 10),
      lastDate:  (sessCount?.last  || '').slice(0, 10),
    }

    db.close()

    return {
      allModels,
      dailyByModel,
      sessions,
      totals,
      generatedAt: new Date().toISOString(),
    }

  } catch (err) {
    db.close()
    return null
  }
}
