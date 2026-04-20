import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// Scan both stock skills and user custom skills
const SKILL_ROOTS = [
  path.join(PROJECT_ROOT, 'skills'),
  path.join(PROJECT_ROOT, '.agent', 'skills'),
]

export interface SkillMeta {
  name: string
  description: string
  file: string
  enabled: boolean
  category?: string
}

let _registry: Map<string, SkillMeta> | null = null

/**
 * Recursively walk a directory and collect all SKILL.md files.
 * Skills are identified by a SKILL.md file inside a named directory.
 * Also picks up flat .md/.txt files at the root level.
 */
function collectSkillFiles(dir: string, map: Map<string, SkillMeta>, category?: string): void {
  if (!fs.existsSync(dir)) return

  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const skillMd = path.join(dir, entry.name, 'SKILL.md')
        if (fs.existsSync(skillMd)) {
          // Directory-style skill: dir-name is the skill name
          const skillName = entry.name
          if (!map.has(skillName)) {
            try {
              const content = fs.readFileSync(skillMd, 'utf8')
              const desc = extractDescription(content)
              map.set(skillName, {
                name: skillName,
                description: desc,
                file: skillMd,
                enabled: true,
                category: category ?? entry.name,
              })
            } catch { /* skip */ }
          }
        } else {
          // Category directory — recurse to find nested skills
          collectSkillFiles(path.join(dir, entry.name), map, category ?? entry.name)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (ext !== '.md' && ext !== '.txt') continue
        const skillName = path.basename(entry.name, ext)
        if (skillName === 'SKILL' || skillName === 'DESCRIPTION') continue
        if (!map.has(skillName)) {
          const filePath = path.join(dir, entry.name)
          try {
            const content = fs.readFileSync(filePath, 'utf8')
            const desc = extractDescription(content)
            map.set(skillName, {
              name: skillName,
              description: desc,
              file: filePath,
              enabled: true,
              category,
            })
          } catch { /* skip */ }
        }
      }
    }
  } catch (err) {
    logger.warn({ err, dir }, 'Failed to read skills directory')
  }
}

function loadRegistry(): Map<string, SkillMeta> {
  const map = new Map<string, SkillMeta>()
  for (const root of SKILL_ROOTS) {
    collectSkillFiles(root, map)
  }
  return map
}

function extractDescription(content: string): string {
  // First non-empty non-heading line after any frontmatter
  const lines = content.split('\n')
  let inFrontmatter = false
  let fmDone = false

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!fmDone) { inFrontmatter = !inFrontmatter; if (!inFrontmatter) fmDone = true; continue }
    }
    if (inFrontmatter) continue
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    return t.slice(0, 120)
  }
  return ''
}

export function getSkillRegistry(): Map<string, SkillMeta> {
  if (!_registry) _registry = loadRegistry()
  return _registry
}

export function reloadSkillRegistry(): Map<string, SkillMeta> {
  _registry = loadRegistry()
  return _registry
}

export function getSkill(name: string): SkillMeta | undefined {
  return getSkillRegistry().get(name)
}

export function listSkills(): SkillMeta[] {
  return [...getSkillRegistry().values()].filter(s => s.enabled)
}

export function getSkillContent(name: string): string | null {
  const skill = getSkill(name)
  if (!skill) return null
  try {
    return fs.readFileSync(skill.file, 'utf8')
  } catch {
    return null
  }
}
