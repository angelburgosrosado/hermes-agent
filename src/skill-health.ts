import { listSkills, getSkillContent } from './skill-registry.js'
import { logger } from './logger.js'

export interface SkillHealthResult {
  name: string
  ok: boolean
  issue?: string
  contentLength: number
}

/**
 * Run a basic health check on all registered skills.
 * Checks that each skill file is readable, non-empty, and has a description.
 */
export function checkSkillHealth(): SkillHealthResult[] {
  const results: SkillHealthResult[] = []

  for (const skill of listSkills()) {
    const content = getSkillContent(skill.name)
    if (content === null) {
      results.push({ name: skill.name, ok: false, issue: 'File not readable', contentLength: 0 })
      continue
    }
    if (content.trim().length === 0) {
      results.push({ name: skill.name, ok: false, issue: 'Empty file', contentLength: 0 })
      continue
    }
    if (!skill.description) {
      results.push({ name: skill.name, ok: false, issue: 'No description found', contentLength: content.length })
      continue
    }
    results.push({ name: skill.name, ok: true, contentLength: content.length })
  }

  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    logger.warn({ count: failed.length }, 'Some skills failed health check')
  }

  return results
}

export function formatSkillHealthReport(results: SkillHealthResult[]): string {
  if (results.length === 0) return 'No skills registered.'
  const lines = results.map(r =>
    `${r.ok ? '✓' : '✗'} ${r.name.padEnd(24)} ${r.ok ? `${r.contentLength} chars` : r.issue}`
  )
  return lines.join('\n')
}
