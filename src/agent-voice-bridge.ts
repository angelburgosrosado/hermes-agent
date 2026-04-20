#!/usr/bin/env node
/**
 * CLI subprocess called by the Python war room to process a transcript
 * and return a JSON response including the reply text.
 *
 * Usage: node agent-voice-bridge.js --persona=hand --text="Hello"
 * Stdout: {"reply":"...","tokens":123}
 */
import { runAgentDispatch } from './agent.js'
import { buildMemoryContext, saveConversationTurn } from './memory.js'
import { initDatabase } from './db.js'
import { logger } from './logger.js'

const PERSONA_PROMPTS: Record<string, string> = {
  hand: 'You are the Hand of the King — a brilliant, pragmatic advisor. Speak with authority and precision.',
  fire: 'You are Daenerys Stormborn — visionary, fierce, and commanding. Lead with conviction.',
  wolf: 'You are the Warden of the North — stoic, direct, and loyal. Honour above all.',
  raven: 'You are the Three-Eyed Raven — ancient, cryptic, and all-seeing. Speak in riddles of truth.',
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const flags: Record<string, string> = {}
  for (const arg of args) {
    const m = /^--(\w[\w-]*)=(.*)$/.exec(arg)
    if (m) flags[m[1]!] = m[2]!
  }

  const persona = flags['persona'] ?? 'hand'
  const text = flags['text'] ?? ''
  const chatId = flags['chat-id'] ?? `warroom:${persona}`

  if (!text) {
    process.stdout.write(JSON.stringify({ error: 'No text provided' }))
    process.exit(1)
  }

  try {
    initDatabase()

    const personaPrompt = PERSONA_PROMPTS[persona] ?? PERSONA_PROMPTS['hand']!
    const memCtx = await buildMemoryContext(chatId, text)

    const fullPrompt = [
      `## Persona\n${personaPrompt}`,
      memCtx ? `## Memory Context\n${memCtx}` : '',
      `## User said\n${text}`,
    ].filter(Boolean).join('\n\n')

    const { result, tokens, cost } = await runAgentDispatch({
      chatId,
      agentId: persona,
      message: fullPrompt,
    })

    saveConversationTurn(chatId, text, result, persona)

    process.stdout.write(JSON.stringify({ reply: result, tokens, cost }))
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'agent-voice-bridge error')
    process.stdout.write(JSON.stringify({ error: (err as Error).message, reply: 'I apologize — the ravens have gone silent. Try again.' }))
    process.exit(1)
  }
}

main()
