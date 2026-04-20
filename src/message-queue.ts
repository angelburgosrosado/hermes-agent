type QueuedTask = () => Promise<void>

const queues = new Map<string, QueuedTask[]>()
const processing = new Set<string>()

export async function enqueue(chatId: string, task: QueuedTask): Promise<void> {
  const queue = queues.get(chatId) ?? []
  queues.set(chatId, queue)

  return new Promise<void>((resolve, reject) => {
    queue.push(async () => {
      try { await task(); resolve() } catch (err) { reject(err) }
    })
    if (!processing.has(chatId)) drain(chatId)
  })
}

async function drain(chatId: string): Promise<void> {
  const queue = queues.get(chatId)
  if (!queue || queue.length === 0) { processing.delete(chatId); return }

  processing.add(chatId)
  const task = queue.shift()!
  try { await task() } catch { /* errors bubble via promise */ }
  await drain(chatId)
}

export function getQueueLength(chatId: string): number {
  return queues.get(chatId)?.length ?? 0
}
