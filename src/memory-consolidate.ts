import { callGemini } from './gemini.js'
import { getUnconsolidatedMemories, markMemoriesConsolidated, saveConsolidation, decayMemorySalience } from './db.js'
import { logger } from './logger.js'
import { CONSOLIDATION_INTERVAL_MS } from './config.js'

const CONSOLIDATION_PROMPT = `Analyze these memories and find patterns. Return ONLY valid JSON, no markdown:
{
  "summary": "overarching summary of what these memories represent",
  "insight": "one non-obvious pattern or preference you noticed",
  "connections": ["memory X relates to memory Y because..."],
  "contradictions": ["user said A but also said B"]
}`

let _intervalHandle: ReturnType<typeof setInterval> | null = null
let _running = false

export async function runConsolidation(chatId: string): Promise<void> {
  if (_running) return
  _running = true
  try {
    const memories = getUnconsolidatedMemories(chatId, 20)
    if (memories.length < 3) return

    const block = memories.map((m, i) => `[${i + 1}] ${m.summary}`).join('\n')
    let result: { summary: string; insight: string; connections: string[]; contradictions: string[] }

    try {
      const raw = await callGemini(`Memories:\n${block}\n\n${CONSOLIDATION_PROMPT}`)
      const cleaned = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim()
      result = JSON.parse(cleaned)
    } catch (err) {
      logger.debug({ err }, 'consolidation: parse failed')
      return
    }

    saveConsolidation(
      chatId,
      result.summary ?? '',
      result.insight ?? '',
      JSON.stringify(result.connections ?? []),
      JSON.stringify(result.contradictions ?? []),
      memories.map(m => m.id)
    )

    markMemoriesConsolidated(memories.map(m => m.id))

    // Decay salience of non-pinned memories (runs every consolidation cycle)
    if (chatId !== '*') {
      decayMemorySalience(chatId)
    }

    logger.debug({ chatId, count: memories.length }, 'memory consolidation complete')
  } catch (err) {
    logger.error({ err }, 'consolidation error')
  } finally {
    _running = false
  }
}

export function startConsolidationLoop(chatId: string, intervalMs = CONSOLIDATION_INTERVAL_MS): void {
  stopConsolidationLoop()
  _intervalHandle = setInterval(() => {
    runConsolidation(chatId).catch(err => logger.error({ err }, 'consolidation loop error'))
  }, intervalMs)
}

export function stopConsolidationLoop(): void {
  if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null }
}

export function isConsolidationLoopRunning(): boolean {
  return _intervalHandle !== null
}
