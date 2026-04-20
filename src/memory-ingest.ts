import { callGemini, getEmbedding } from './gemini.js'
import { saveMemory, getMemoryById, supersedMemory } from './db.js'
import { embeddingToBuffer, bufferToEmbedding, cosineSimilarity, findSimilarMemories } from './embeddings.js'
import { logger } from './logger.js'

const EXTRACTION_PROMPT = `Extract key facts from this conversation turn. Return ONLY valid JSON, no markdown:
{
  "skip": false,
  "summary": "one sentence summary of what was discussed or decided",
  "entities": ["person names", "project names", "tools mentioned"],
  "topics": ["high level topics"],
  "importance": 0.7,
  "salience": 3
}
If the message is trivial (greetings, acknowledgments, simple yes/no, one word), set skip=true.
Importance scale: 0.0=trivial, 0.5=routine, 0.7=notable, 1.0=critical decision or preference.
Salience scale: 0=noise, 1=low, 2=moderate, 3=notable, 4=high, 5=critical.`

interface ExtractionResult {
  skip: boolean
  summary: string
  entities: string[]
  topics: string[]
  importance: number
  salience: number
}

export async function ingestConversationTurn(
  chatId: string,
  role: 'user' | 'assistant',
  text: string,
  _sessionId?: string,
  agentId = 'main'
): Promise<void> {
  // Hard filters
  if (text.trim().length < 15) return
  if (text.trim().startsWith('/')) return

  const truncated = text.slice(0, 2000)

  let extracted: ExtractionResult
  try {
    const raw = await callGemini(
      `Role: ${role}\nMessage: ${truncated}\n\n${EXTRACTION_PROMPT}`
    )
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim()
    extracted = JSON.parse(cleaned)
  } catch (err) {
    logger.debug({ err }, 'memory-ingest: extraction failed')
    return
  }

  if (extracted.skip) return
  if ((extracted.importance ?? 0) < 0.5) return

  // Generate embedding
  let embedding: number[]
  try {
    embedding = await getEmbedding(extracted.summary)
  } catch {
    return
  }

  if (!embedding || embedding.length === 0) return

  // Duplicate check (0.85 cosine threshold)
  const similar = await findSimilarMemories(chatId, embedding, 1, 0.85)
  if (similar.length > 0) {
    const existing = getMemoryById(similar[0].id)
    if (existing) {
      // Check for contradiction — if new importance is higher, supersede
      if (extracted.importance > existing.importance) {
        const newId = saveMemory({
          chat_id: chatId,
          agent_id: agentId,
          raw_text: truncated,
          summary: extracted.summary,
          entities: JSON.stringify(extracted.entities ?? []),
          topics: JSON.stringify(extracted.topics ?? []),
          importance: extracted.importance,
          salience: extracted.salience,
          pinned: 0,
          consolidated: 0,
          embedding: embeddingToBuffer(embedding),
          superseded_by: null,
          created_at: Date.now(),
          accessed_at: Date.now(),
        })
        supersedMemory(existing.id, newId)
      }
      // else: just a near-duplicate, skip
      return
    }
  }

  // Save new memory
  saveMemory({
    chat_id: chatId,
    agent_id: agentId,
    raw_text: truncated,
    summary: extracted.summary,
    entities: JSON.stringify(extracted.entities ?? []),
    topics: JSON.stringify(extracted.topics ?? []),
    importance: extracted.importance,
    salience: extracted.salience,
    pinned: 0,
    consolidated: 0,
    embedding: embeddingToBuffer(embedding),
    superseded_by: null,
    created_at: Date.now(),
    accessed_at: Date.now(),
  })
}
