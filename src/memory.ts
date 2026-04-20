import { getEmbedding } from './gemini.js'
import { findSimilarMemories } from './embeddings.js'
import {
  getHighImportanceMemories, getRecentConsolidations, getRecentHiveMind,
  getRecentConversation, getMemoryById, searchMemoriesFts,
  deleteOldLowImportanceMemories
} from './db.js'
import { ingestConversationTurn } from './memory-ingest.js'
import { logger } from './logger.js'
import { MEMORY_NUDGE_INTERVAL_TURNS, MEMORY_NUDGE_INTERVAL_HOURS } from './config.js'

const _nudgeState = new Map<string, { turns: number; lastNudgeAt: number }>()

export async function buildMemoryContext(chatId: string, userMessage: string): Promise<string> {
  const parts: string[] = []
  const seenIds = new Set<number>()

  try {
    // Layer 1: Embedding similarity
    const embedding = await getEmbedding(userMessage).catch(() => null)
    if (embedding && embedding.length > 0) {
      const similar = await findSimilarMemories(chatId, embedding, 5, 0.3)
      for (const { id } of similar) {
        if (seenIds.has(id)) continue
        seenIds.add(id)
        const m = getMemoryById(id)
        if (m) parts.push(`- ${m.summary} (importance: ${m.importance.toFixed(2)})`)
      }
    }

    // Layer 2: FTS keyword search
    const keywords = userMessage.slice(0, 100).replace(/[^\w\s]/g, ' ').trim()
    if (keywords.length > 3) {
      const ftsResults = searchMemoriesFts(chatId, keywords, 3)
      for (const m of ftsResults) {
        if (seenIds.has(m.id)) continue
        seenIds.add(m.id)
        parts.push(`- ${m.summary} (importance: ${m.importance.toFixed(2)})`)
      }
    }

    // Layer 3: Recent high-importance memories
    const highImportance = getHighImportanceMemories(chatId, 0.7, 5)
    for (const m of highImportance) {
      if (seenIds.has(m.id)) continue
      seenIds.add(m.id)
      parts.push(`- ${m.summary} (importance: ${m.importance.toFixed(2)})`)
    }

    // Layer 4: Consolidation insights
    const consolidations = getRecentConsolidations(chatId, 2)
    for (const c of consolidations) {
      if (c.insight) parts.push(`- [Insight] ${c.insight}`)
    }

    // Layer 5: Hive mind context
    const hive = getRecentHiveMind(3)
    for (const h of hive) {
      parts.push(`- [${h.agent_id}] ${h.summary}`)
    }
  } catch (err) {
    logger.debug({ err }, 'buildMemoryContext partial error')
  }

  if (parts.length === 0) return ''
  return `[Memory context]\n${parts.join('\n')}`
}

export async function saveConversationTurn(chatId: string, userMsg: string, assistantMsg: string, agentId = 'main'): Promise<void> {
  // Fire-and-forget
  Promise.all([
    ingestConversationTurn(chatId, 'user', userMsg, undefined, agentId),
    ingestConversationTurn(chatId, 'assistant', assistantMsg, undefined, agentId),
  ]).catch(err => logger.debug({ err }, 'saveConversationTurn error'))

  // Track nudge state
  const state = _nudgeState.get(chatId) ?? { turns: 0, lastNudgeAt: Date.now() }
  state.turns++
  _nudgeState.set(chatId, state)
}

export function shouldNudgeMemory(chatId: string): boolean {
  const state = _nudgeState.get(chatId)
  if (!state) return false
  const turnsSinceLast = state.turns
  const hoursSinceLast = (Date.now() - state.lastNudgeAt) / 3600000
  return turnsSinceLast >= MEMORY_NUDGE_INTERVAL_TURNS || hoursSinceLast >= MEMORY_NUDGE_INTERVAL_HOURS
}

export function resetNudgeState(chatId: string): void {
  _nudgeState.set(chatId, { turns: 0, lastNudgeAt: Date.now() })
}

export async function runDecaySweep(): Promise<void> {
  // Remove old low-importance memories for all chats
  try {
    deleteOldLowImportanceMemories('', 60, 0.3)
  } catch (err) {
    logger.debug({ err }, 'decay sweep error')
  }
}
