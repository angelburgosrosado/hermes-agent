import { EventEmitter } from 'events'

export type ChatEventType =
  | 'user_message'
  | 'assistant_message'
  | 'processing'
  | 'progress'
  | 'error'
  | 'hive_mind'

export interface ChatEvent {
  type: ChatEventType
  chatId: string
  agentId?: string
  data: unknown
  timestamp: number
}

export const chatEvents = new EventEmitter()
chatEvents.setMaxListeners(100)

export const voiceEnabledChats = new Set<string>()
export const activeSessions = new Map<string, { startedAt: number; agentId?: string }>()
export const abortControllers = new Map<string, AbortController>()

// Security state
let _isSystemLocked = false
let _lastActivityAt = Date.now()

export function isSystemLocked(): boolean { return _isSystemLocked }
export function setLocked(locked: boolean): void { _isSystemLocked = locked }
export function getLastActivityAt(): number { return _lastActivityAt }
export function touchActivity(): void { _lastActivityAt = Date.now() }

export function emitChatEvent(event: Omit<ChatEvent, 'timestamp'>): void {
  chatEvents.emit('chat', { ...event, timestamp: Date.now() })
}
