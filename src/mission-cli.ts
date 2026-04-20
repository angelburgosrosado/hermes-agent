#!/usr/bin/env node
import {
  getMissionTasks, getMissionTask, createMissionTask, updateMissionTask,
  deleteMissionTask, MissionTask,
} from './db.js'

export type { MissionTask }

function usage(): void {
  console.log(`
ClaudeClaw Mission Control CLI

Usage:
  mission list [--status=<status>] [--agent=<id>]
  mission create --title=<title> [--description=<desc>] [--agent=<id>] [--priority=critical|high|medium|low] [--due=<ISO-date>]
  mission show <id>
  mission update <id> --status=<status> [--notes=<text>]
  mission assign <id> --agent=<id>
  mission close <id>
  mission delete <id>
`)
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (const arg of args) {
    const m = /^--(\w[\w-]*)=(.*)$/.exec(arg)
    if (m) flags[m[1]!] = m[2]!
  }
  return flags
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '\x1b[31m', high: '\x1b[33m', medium: '\x1b[36m', low: '\x1b[37m',
}
const RESET = '\x1b[0m'

function colorPriority(p: string): string {
  return `${PRIORITY_COLORS[p] ?? ''}${p}${RESET}`
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (!cmd || cmd === 'help') { usage(); process.exit(0) }

  if (cmd === 'list') {
    const flags = parseFlags(args.slice(1))
    const tasks = getMissionTasks({
      status: flags['status'],
      agent_id: flags['agent'],
    })

    if (tasks.length === 0) { console.log('No mission tasks found.'); return }

    console.log('\nID                    Priority  Status       Agent             Title')
    console.log('─'.repeat(90))
    for (const t of tasks) {
      const id = t.id.slice(0, 20).padEnd(22)
      const pri = colorPriority(t.priority_label ?? 'medium').padEnd(8)
      const status = (t.status ?? 'pending').padEnd(13)
      const agent = (t.agent_id ?? '—').padEnd(18)
      const title = (t.title ?? t.prompt ?? '').slice(0, 40)
      console.log(`${id}${pri}${status}${agent}${title}`)
    }
    return
  }

  if (cmd === 'create') {
    const flags = parseFlags(args.slice(1))
    if (!flags['title']) { console.error('Error: --title is required'); process.exit(1) }
    const task = createMissionTask({
      title: flags['title'],
      description: flags['description'],
      agent_id: flags['agent'] ?? null,
      priority: flags['priority'] ?? 'medium',
      status: 'pending',
      due_at: flags['due'] ? new Date(flags['due']).getTime() : null,
    })
    console.log(`✓ Mission task ${task.id} created: ${task.title}`)
    return
  }

  if (cmd === 'show') {
    const id = args[1]
    if (!id) { console.error('Usage: mission show <id>'); process.exit(1) }
    const task = getMissionTask(id)
    if (!task) { console.error('Task not found'); process.exit(1) }
    console.log(`\n${task.id} — ${task.title ?? task.prompt}`)
    console.log(`Status:   ${task.status}`)
    console.log(`Priority: ${task.priority_label}`)
    console.log(`Agent:    ${task.agent_id ?? '—'}`)
    if (task.due_at) console.log(`Due:      ${new Date(task.due_at).toLocaleDateString()}`)
    if (task.description) console.log(`\n${task.description}`)
    if (task.notes) console.log(`\nNotes: ${task.notes}`)
    return
  }

  if (cmd === 'update') {
    const id = args[1]
    if (!id) { console.error('Usage: mission update <id> --status=<status>'); process.exit(1) }
    const flags = parseFlags(args.slice(2))
    updateMissionTask(id, {
      ...(flags['status'] ? { status: flags['status'] } : {}),
      ...(flags['notes'] ? { notes: flags['notes'] } : {}),
      ...(flags['priority'] ? { priority_label: flags['priority'] } : {}),
    })
    console.log(`✓ Task ${id} updated`)
    return
  }

  if (cmd === 'assign') {
    const id = args[1]
    if (!id) { console.error('Usage: mission assign <id> --agent=<id>'); process.exit(1) }
    const flags = parseFlags(args.slice(2))
    if (!flags['agent']) { console.error('Error: --agent is required'); process.exit(1) }
    updateMissionTask(id, { agent_id: flags['agent'] })
    console.log(`✓ Task ${id} assigned to ${flags['agent']}`)
    return
  }

  if (cmd === 'close') {
    const id = args[1]
    if (!id) { console.error('Usage: mission close <id>'); process.exit(1) }
    updateMissionTask(id, { status: 'done' })
    console.log(`✓ Task ${id} closed`)
    return
  }

  if (cmd === 'delete') {
    const id = args[1]
    if (!id) { console.error('Usage: mission delete <id>'); process.exit(1) }
    deleteMissionTask(id)
    console.log(`✓ Task ${id} deleted`)
    return
  }

  console.error(`Unknown command: ${cmd}`)
  usage()
  process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
