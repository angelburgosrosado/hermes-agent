import { getAllMemoryEmbeddings, touchMemory } from './db.js'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function embeddingToBuffer(embedding: number[]): Buffer {
  const buf = Buffer.allocUnsafe(embedding.length * 4)
  for (let i = 0; i < embedding.length; i++) buf.writeFloatLE(embedding[i], i * 4)
  return buf
}

export function bufferToEmbedding(buffer: Buffer): number[] {
  const result: number[] = []
  for (let i = 0; i < buffer.length; i += 4) result.push(buffer.readFloatLE(i))
  return result
}

export async function findSimilarMemories(
  chatId: string,
  queryEmbedding: number[],
  limit = 5,
  threshold = 0.3
): Promise<Array<{ id: number; similarity: number }>> {
  const rows = getAllMemoryEmbeddings(chatId)
  const scored: Array<{ id: number; similarity: number }> = []

  for (const row of rows) {
    if (!row.embedding) continue
    const emb = bufferToEmbedding(row.embedding)
    const sim = cosineSimilarity(queryEmbedding, emb)
    if (sim >= threshold) scored.push({ id: row.id, similarity: sim })
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  const top = scored.slice(0, limit)
  for (const m of top) touchMemory(m.id)
  return top
}
