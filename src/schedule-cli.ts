#!/usr/bin/env node
import {
  scheduleTask, getScheduledTasks, pauseTask, resumeTask, removeTask, computeNextRun,
} from './scheduler.js'
import { getAllTasks } from './db.js'

function usage(): void {
  console.log(`
ClaudeClaw Scheduler CLI

Usage:
  schedule list
  schedule create --prompt=<prompt> --cron=<expr> [--name=<name>] [--agent=<id>] [--chat=<id>] [--priority=1-5]
  schedule pause <id>
  schedule resume <id>
  schedule delete <id>
  schedule next <cron-expr>
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

function formatDate(ts: number | null | undefined): string {
  if (!ts) return 'never'
  return new Date(ts).toLocaleString()
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (!cmd || cmd === 'help') { usage(); process.exit(0) }

  if (cmd === 'list') {
    const tasks = getAllTasks()
    if (tasks.length === 0) { console.log('No scheduled tasks.'); return }
    console.log('\nID              Schedule          Next Run              Status    Agent')
    console.log('─'.repeat(90))
    for (const t of tasks) {
      const id = t.id.slice(0, 14).padEnd(16)
      const cron = (t.schedule ?? '').padEnd(18)
      const next = formatDate(t.next_run).padEnd(22)
      const status = (t.status ?? '').padEnd(10)
      const agent = t.agent_id ?? ''
      console.log(`${id}${cron}${next}${status}${agent}`)
    }
    return
  }

  if (cmd === 'create') {
    const flags = parseFlags(args.slice(1))
    if (!flags['prompt'] || !flags['cron']) {
      console.error('Error: --prompt and --cron are required')
      process.exit(1)
    }
    const next = computeNextRun(flags['cron'])
    if (!next) { console.error('Invalid cron expression'); process.exit(1) }
    const task = scheduleTask({
      name: flags['name'],
      prompt: flags['prompt'],
      cronExpr: flags['cron'],
      agentId: flags['agent'],
      chatId: flags['chat'],
      priority: flags['priority'] ? parseInt(flags['priority']) : undefined,
    })
    console.log(`✓ Task ${task.id} created. Next run: ${formatDate(task.next_run)}`)
    return
  }

  if (cmd === 'pause') {
    const id = args[1]
    if (!id) { console.error('Usage: schedule pause <id>'); process.exit(1) }
    pauseTask(id)
    console.log(`✓ Task ${id} paused`)
    return
  }

  if (cmd === 'resume') {
    const id = args[1]
    if (!id) { console.error('Usage: schedule resume <id>'); process.exit(1) }
    resumeTask(id)
    console.log(`✓ Task ${id} resumed`)
    return
  }

  if (cmd === 'delete') {
    const id = args[1]
    if (!id) { console.error('Usage: schedule delete <id>'); process.exit(1) }
    removeTask(id)
    console.log(`✓ Task ${id} deleted`)
    return
  }

  if (cmd === 'next') {
    const expr = args[1]
    if (!expr) { console.error('Usage: schedule next <cron-expr>'); process.exit(1) }
    const next = computeNextRun(expr)
    if (!next) { console.error('Invalid cron expression'); process.exit(1) }
    console.log(`Next run: ${next.toLocaleString()}`)
    return
  }

  console.error(`Unknown command: ${cmd}`)
  usage()
  process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
