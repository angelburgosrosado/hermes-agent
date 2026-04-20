/**
 * meet-cli.ts — Meeting Bot CLI
 *
 * Commands:
 *   join <url>          Join a meeting via Recall.ai bot
 *   brief <url>         Generate pre-flight briefing (Calendar + Gmail + Memory → Gemini)
 *   status <id>         Poll meeting bot status
 *   leave <id>          Remove bot from meeting
 *   list                List recent meeting sessions
 *   summary <id>        Generate/retrieve meeting summary
 *
 * Usage: node dist/meet-cli.js <command> [args]
 */

import { createMeetSession, getMeetSession, getRecentMeetSessions, updateMeetSession } from './db.js'
import { callGemini } from './gemini.js'
import { buildMemoryContext } from './memory.js'
import { logger } from './logger.js'
import { RECALL_API_KEY, PIKA_API_KEY, ANTHROPIC_API_KEY } from './config.js'
import { initDatabase } from './db.js'

// ── Recall.ai client ──────────────────────────────────────────────────────────

const RECALL_BASE = 'https://us-east-1.recall.ai/api/v1'

async function recallRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!RECALL_API_KEY) throw new Error('RECALL_API_KEY not set')

  const res = await fetch(`${RECALL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Token ${RECALL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Recall API ${res.status}: ${text}`)
  }

  return res.json()
}

// ── Bot management ────────────────────────────────────────────────────────────

interface RecallBot {
  id: string
  status: { code: string; message?: string }
  meeting_url: string
}

export async function joinMeeting(meetingUrl: string, botName = 'ClaudeClaw'): Promise<{ botId: string; sessionId: number }> {
  const bot = await recallRequest('POST', '/bot/', {
    meeting_url: meetingUrl,
    bot_name: botName,
    transcription_options: { provider: 'default' },
    recording_config: { transcript: true },
  }) as RecallBot

  const sessionId = createMeetSession(meetingUrl, meetingUrl)
  updateMeetSession(sessionId, { status: 'active', meeting_title: bot.id })

  logger.info({ botId: bot.id, sessionId }, 'Meeting bot joined')
  return { botId: bot.id, sessionId }
}

export async function leaveMeeting(botId: string): Promise<void> {
  await recallRequest('POST', `/bot/${botId}/leave_call/`)
  logger.info({ botId }, 'Meeting bot left call')
}

export async function getBotStatus(botId: string): Promise<RecallBot> {
  return recallRequest('GET', `/bot/${botId}/`) as Promise<RecallBot>
}

export async function getBotTranscript(botId: string): Promise<string> {
  const data = await recallRequest('GET', `/bot/${botId}/transcript/`) as { results?: { words: { text: string; speaker?: string }[] }[] }
  if (!data.results?.length) return ''

  return data.results
    .flatMap(r => r.words)
    .map(w => (w.speaker ? `${w.speaker}: ` : '') + w.text)
    .join(' ')
}

// ── Pre-flight briefing pipeline ──────────────────────────────────────────────
// Budget: 75 seconds. Sources: Memory context + meeting URL meta

const BRIEFING_PROMPT = `You are preparing a pre-flight briefing for an upcoming meeting.
Given the meeting details and context, produce a concise brief covering:
1. Known attendees and their roles (from memory/context)
2. Likely agenda topics
3. Key decisions or context relevant to this meeting
4. Suggested talking points or questions to raise
5. Any risks or blockers to be aware of

Keep it under 300 words. Bullet points preferred.`

export async function generateBriefing(
  meetingUrl: string,
  chatId: string,
  extraContext?: string
): Promise<string> {
  const memCtx = await buildMemoryContext(chatId, `meeting: ${meetingUrl}`)

  const prompt = [
    `Meeting URL: ${meetingUrl}`,
    memCtx ? `\n## Memory Context\n${memCtx}` : '',
    extraContext ? `\n## Additional Context\n${extraContext}` : '',
    `\n\n${BRIEFING_PROMPT}`,
  ].filter(Boolean).join('\n')

  const briefing = await callGemini(prompt)
  return briefing
}

// ── Post-meeting summary ──────────────────────────────────────────────────────

const SUMMARY_PROMPT = `Analyze this meeting transcript and produce a structured summary:

## Summary
[2-3 sentence overview]

## Key Decisions
[Bullet list]

## Action Items
[Bullet list with owner if mentioned]

## Next Steps
[What was agreed to happen next]

Keep it concise. Focus on decisions and actions over discussion.`

export async function generateSummary(transcript: string): Promise<string> {
  if (!transcript || transcript.length < 50) return 'No transcript available.'

  const truncated = transcript.slice(0, 8000)
  const prompt = `Transcript:\n${truncated}\n\n${SUMMARY_PROMPT}`
  return callGemini(prompt)
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(): { command: string; args: string[] } {
  const argv = process.argv.slice(2)
  const command = argv[0] ?? 'help'
  const args = argv.slice(1)
  return { command, args }
}

function printUsage(): void {
  console.log(`
meet-cli — ClaudeClaw Meeting Bot

Commands:
  join <url>            Join meeting, returns bot ID + session ID
  leave <bot-id>        Remove bot from meeting
  status <bot-id>       Show current bot status
  brief <url>           Generate pre-flight briefing
  summary <bot-id>      Fetch transcript and generate summary
  list                  List recent meeting sessions
  help                  Show this help
`)
}

async function main(): Promise<void> {
  initDatabase()

  const { command, args } = parseArgs()

  switch (command) {
    case 'join': {
      const url = args[0]
      if (!url) { console.error('Usage: meet-cli join <meeting-url>'); process.exit(1) }
      const { botId, sessionId } = await joinMeeting(url)
      console.log(JSON.stringify({ botId, sessionId }))
      break
    }

    case 'leave': {
      const botId = args[0]
      if (!botId) { console.error('Usage: meet-cli leave <bot-id>'); process.exit(1) }
      await leaveMeeting(botId)
      console.log(`Bot ${botId} left the call.`)
      break
    }

    case 'status': {
      const botId = args[0]
      if (!botId) { console.error('Usage: meet-cli status <bot-id>'); process.exit(1) }
      const status = await getBotStatus(botId)
      console.log(JSON.stringify(status, null, 2))
      break
    }

    case 'brief': {
      const url = args[0]
      if (!url) { console.error('Usage: meet-cli brief <meeting-url>'); process.exit(1) }
      const chatId = args[1] ?? 'meet-brief'
      console.log('Generating pre-flight briefing…\n')
      const briefing = await generateBriefing(url, chatId)
      console.log(briefing)
      break
    }

    case 'summary': {
      const botId = args[0]
      if (!botId) { console.error('Usage: meet-cli summary <bot-id>'); process.exit(1) }

      console.log('Fetching transcript…')
      const transcript = await getBotTranscript(botId)
      if (!transcript) { console.log('No transcript available yet.'); break }

      console.log('Generating summary…\n')
      const summary = await generateSummary(transcript)
      console.log(summary)
      break
    }

    case 'list': {
      const sessions = getRecentMeetSessions(20)
      if (sessions.length === 0) { console.log('No meeting sessions found.'); break }
      for (const s of sessions) {
        const date = new Date(s.created_at).toLocaleString()
        console.log(`[${s.id}] ${s.status.padEnd(10)} ${date}  ${s.meeting_url}`)
      }
      break
    }

    case 'help':
    default:
      printUsage()
  }
}

main().catch(err => {
  logger.error({ err }, 'meet-cli error')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
