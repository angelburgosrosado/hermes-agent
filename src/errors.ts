export type ErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'context_exhausted'
  | 'timeout'
  | 'subprocess_crash'
  | 'network'
  | 'billing'
  | 'overloaded'
  | 'unknown'

export interface ErrorRecovery {
  shouldRetry: boolean
  shouldNewChat: boolean
  shouldSwitchModel: boolean
  retryAfterMs: number
  userMessage: string
}

const PATTERNS: Record<ErrorCategory, string[]> = {
  auth: ['unauthorized', '401', 'invalid api key', 'authentication', 'forbidden', '403'],
  rate_limit: ['rate limit', '429', 'too many requests', 'quota exceeded', 'ratelimit'],
  context_exhausted: ['context window', 'max tokens', 'context length', 'too long', 'token limit'],
  timeout: ['timeout', 'timed out', 'etimedout', 'deadline exceeded'],
  subprocess_crash: ['exited with code', 'spawn error', 'enoent', 'process failed'],
  network: ['econnrefused', 'enotfound', 'network error', 'fetch failed', 'socket hang'],
  billing: ['billing', 'payment', 'credit', 'insufficient funds', 'account suspended'],
  overloaded: ['overloaded', '529', 'service unavailable', '503', 'capacity'],
  unknown: [],
}

const RECOVERY: Record<ErrorCategory, ErrorRecovery> = {
  auth: { shouldRetry: false, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 0, userMessage: 'Authentication error — check your API key.' },
  rate_limit: { shouldRetry: true, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 30000, userMessage: 'Rate limited — retrying in 30 seconds.' },
  context_exhausted: { shouldRetry: false, shouldNewChat: true, shouldSwitchModel: false, retryAfterMs: 0, userMessage: 'Context window full. Starting a new chat session.' },
  timeout: { shouldRetry: true, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 5000, userMessage: 'Request timed out — retrying.' },
  subprocess_crash: { shouldRetry: true, shouldNewChat: true, shouldSwitchModel: false, retryAfterMs: 2000, userMessage: 'Agent process crashed — restarting.' },
  network: { shouldRetry: true, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 5000, userMessage: 'Network error — retrying.' },
  billing: { shouldRetry: false, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 0, userMessage: 'Billing issue — check your account.' },
  overloaded: { shouldRetry: true, shouldNewChat: false, shouldSwitchModel: true, retryAfterMs: 10000, userMessage: 'Service overloaded — retrying with fallback.' },
  unknown: { shouldRetry: true, shouldNewChat: false, shouldSwitchModel: false, retryAfterMs: 3000, userMessage: 'Something went wrong — retrying.' },
}

export function classifyError(error: Error | string): { category: ErrorCategory; recovery: ErrorRecovery } {
  const msg = (typeof error === 'string' ? error : error.message).toLowerCase()
  for (const [cat, patterns] of Object.entries(PATTERNS) as [ErrorCategory, string[]][]) {
    if (cat === 'unknown') continue
    if (patterns.some(p => msg.includes(p))) {
      return { category: cat, recovery: RECOVERY[cat] }
    }
  }
  return { category: 'unknown', recovery: RECOVERY.unknown }
}
