import fs from 'fs'
import path from 'path'
import { logger } from './logger.js'

export interface ObsidianContext {
  notes: string[]
  summary: string
}

/**
 * Read Obsidian vault notes matching a topic query.
 * Returns a summarised context string suitable for injecting into agent prompts.
 */
export function buildObsidianContext(vaultPath: string, query: string, maxNotes = 5): ObsidianContext {
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    return { notes: [], summary: '' }
  }

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  if (terms.length === 0) return { notes: [], summary: '' }

  const mdFiles = findMdFiles(vaultPath)
  const scored: Array<{ file: string; score: number; excerpt: string }> = []

  for (const file of mdFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8')
      const lower = content.toLowerCase()
      const score = terms.reduce((s, t) => s + (lower.split(t).length - 1), 0)
      if (score === 0) continue

      const excerpt = extractExcerpt(content, terms, 300)
      scored.push({ file, score, excerpt })
    } catch { /* skip unreadable files */ }
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, maxNotes)

  if (top.length === 0) return { notes: [], summary: '' }

  const notes = top.map(t => path.relative(vaultPath, t.file))
  const summary = top.map(t =>
    `### ${path.basename(t.file, '.md')}\n${t.excerpt}`
  ).join('\n\n')

  logger.debug({ query, matched: top.length }, 'Obsidian context built')
  return { notes, summary }
}

function findMdFiles(dir: string, depth = 0, maxDepth = 4): string[] {
  if (depth > maxDepth) return []
  const files: string[] = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...findMdFiles(full, depth + 1, maxDepth))
      } else if (entry.name.endsWith('.md')) {
        files.push(full)
      }
    }
  } catch { /* ignore permission errors */ }
  return files
}

function extractExcerpt(content: string, terms: string[], maxLen: number): string {
  const lower = content.toLowerCase()
  let bestStart = 0
  let bestScore = 0

  // Find the 200-char window with the most term hits
  for (let i = 0; i < content.length - maxLen; i += 50) {
    const window = lower.slice(i, i + maxLen)
    const score = terms.reduce((s, t) => s + (window.split(t).length - 1), 0)
    if (score > bestScore) { bestScore = score; bestStart = i }
  }

  let excerpt = content.slice(bestStart, bestStart + maxLen).trim()
  if (bestStart > 0) excerpt = '…' + excerpt
  if (bestStart + maxLen < content.length) excerpt += '…'
  return excerpt
}
