export type MessageComplexity = 'simple' | 'complex'

const SIMPLE_PATTERNS = [
  /^(ok|okay|k|got it|thanks|thank you|thx|ty|yep|yeah|yes|no|nope|sure|cool|great|nice|perfect|sounds good|roger|copy|ack|acknowledged|noted|understood|alright|fine|done|stop|cancel|skip)\.?$/i,
  /^[\p{Emoji}\s]+$/u,
  /^.{1,3}$/,
]

export function classifyMessage(text: string): MessageComplexity {
  const trimmed = text.trim()
  if (SIMPLE_PATTERNS.some(p => p.test(trimmed))) return 'simple'
  return 'complex'
}
