import pkg from 'cron-parser'
const { parseExpression } = pkg as any
import {
  createTask, getDueTasks as dbGetDueTasks, getAllTasks, updateTaskAfterRun,
  setTaskStatus, deleteTask, ScheduledTask,
} from './db.js'
import { runAgentDispatch } from './agent.js'
import { logger } from './logger.js'
import crypto from 'crypto'

export type { ScheduledTask }

let _pollInterval: NodeJS.Timeout | null = null
const POLL_MS = 60_000

// ---------- Next-run computation ----------

export function computeNextRun(cronExpr: string, from = new Date()): Date | null {
  try {
    const interval = parseExpression(cronExpr, { currentDate: from })
    return interval.next().toDate()
  } catch {
    return null
  }
}

// ---------- Task management ----------

export function scheduleTask(opts: {
  name?: string
  prompt: string
  cronExpr: string
  agentId?: string
  chatId?: string
  priority?: number
}): ScheduledTask {
  const next = computeNextRun(opts.cronExpr)
  if (!next) throw new Error(`Invalid cron expression: ${opts.cronExpr}`)

  const id = `task-${crypto.randomBytes(4).toString('hex')}`
  const now = Date.now()

  createTask({
    id,
    chat_id: opts.chatId ?? 'scheduler',
    prompt: opts.prompt,
    schedule: opts.cronExpr,
    next_run: next.getTime(),
    priority: opts.priority ?? 3,
    agent_id: opts.agentId ?? 'orchestrator',
    status: 'active',
    created_at: now,
  })

  const tasks = getAllTasks()
  return tasks.find(t => t.id === id)!
}

export function getScheduledTasks(): ScheduledTask[] {
  return getAllTasks()
}

export function pauseTask(id: string): void {
  setTaskStatus(id, 'paused')
}

export function resumeTask(id: string): void {
  setTaskStatus(id, 'active')
}

export function removeTask(id: string): void {
  deleteTask(id)
}

// ---------- Execution ----------

async function executeTask(task: ScheduledTask): Promise<void> {
  logger.info({ taskId: task.id, schedule: task.schedule }, 'Executing scheduled task')
  setTaskStatus(task.id, 'running')

  try {
    const { result, tokens, cost } = await runAgentDispatch({
      chatId: task.chat_id,
      agentId: task.agent_id,
      message: task.prompt,
    })
    const next = computeNextRun(task.schedule) ?? new Date(Date.now() + 86400000)
    updateTaskAfterRun(task.id, next.getTime(), result.slice(0, 500))
    logger.info({ taskId: task.id, tokens, cost }, 'Scheduled task completed')
  } catch (err) {
    logger.error({ err, taskId: task.id }, 'Scheduled task failed')
    setTaskStatus(task.id, 'failed')
  }
}

// ---------- Poll loop ----------

export function startScheduler(): void {
  if (_pollInterval) return
  _pollInterval = setInterval(async () => {
    const due = dbGetDueTasks()
    for (const task of due) {
      executeTask(task).catch(err => logger.error({ err, taskId: task.id }, 'Task error'))
    }
  }, POLL_MS)
  logger.info('Scheduler started')
}

export function stopScheduler(): void {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null }
}

export function isSchedulerRunning(): boolean {
  return _pollInterval !== null
}
