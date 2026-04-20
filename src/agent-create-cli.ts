#!/usr/bin/env node
import readline from 'readline'
import { createAgent, deleteAgent, listExistingAgents, validateAgentId, AgentCreateOptions } from './agent-create.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r))

async function wizard(): Promise<void> {
  console.log('\n=== ClaudeClaw Agent Creation Wizard ===\n')

  const id = await ask('Agent ID (e.g. research, ops, comms): ')
  const idErr = validateAgentId(id.trim())
  if (idErr) { console.error(`Error: ${idErr}`); process.exit(1) }

  const name = await ask('Display name: ')
  const description = await ask('Short description: ')
  const systemPrompt = await ask('System prompt (leave blank for default): ')

  const modelInput = await ask('Model [claude-sonnet-4-6]: ')
  const model = modelInput.trim() || 'claude-sonnet-4-6'

  const toolsInput = await ask('Tools (comma-separated, leave blank for defaults): ')
  const tools = toolsInput.trim() ? toolsInput.split(',').map(t => t.trim()).filter(Boolean) : undefined

  const telegramToken = await ask('Dedicated Telegram bot token (leave blank to skip): ')
  const maxTurnsInput = await ask('Max turns [30]: ')
  const maxTurns = parseInt(maxTurnsInput.trim() || '30') || 30

  rl.close()

  const opts: AgentCreateOptions = {
    id: id.trim(),
    name: name.trim(),
    description: description.trim(),
    model,
    systemPrompt: systemPrompt.trim() || undefined,
    tools,
    maxTurns,
    telegramToken: telegramToken.trim() || undefined,
  }

  console.log('\nCreating agent...')
  const result = await createAgent(opts)

  if (result.success) {
    console.log(`\n✓ ${result.message}`)
    console.log(`  Files created in: ${result.agentDir}`)
    console.log('\nNext steps:')
    console.log(`  1. Edit agents/${opts.id}/CLAUDE.md to customize the system prompt`)
    console.log(`  2. Restart ClaudeClaw to load the new agent`)
    console.log(`  3. Use @${opts.id} in Telegram to delegate tasks`)
  } else {
    console.error(`\n✗ ${result.message}`)
    process.exit(1)
  }
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (cmd === 'list') {
    const agents = listExistingAgents()
    if (agents.length === 0) {
      console.log('No agents configured.')
    } else {
      console.log('\nConfigured agents:')
      for (const a of agents) {
        console.log(`  ${a.id.padEnd(16)} ${a.name} — ${a.description}`)
      }
    }
    process.exit(0)
  }

  if (cmd === 'delete') {
    const agentId = args[1]
    if (!agentId) { console.error('Usage: agent-create delete <agentId>'); process.exit(1) }
    const result = await deleteAgent(agentId)
    console.log(result.success ? `✓ ${result.message}` : `✗ ${result.message}`)
    process.exit(result.success ? 0 : 1)
  }

  if (cmd === 'create') {
    // Non-interactive: agent-create create --id=X --name=Y --description=Z
    const flags: Record<string, string> = {}
    for (const arg of args.slice(1)) {
      const m = /^--(\w[\w-]*)=(.*)$/.exec(arg)
      if (m) flags[m[1]!] = m[2]!
    }
    if (!flags['id'] || !flags['name'] || !flags['description']) {
      console.error('Usage: agent-create create --id=X --name=Y --description=Z [--model=M] [--max-turns=N]')
      process.exit(1)
    }
    const result = await createAgent({
      id: flags['id'],
      name: flags['name'],
      description: flags['description'],
      model: flags['model'],
      systemPrompt: flags['system-prompt'],
      maxTurns: flags['max-turns'] ? parseInt(flags['max-turns']) : undefined,
      telegramToken: flags['telegram-token'],
    })
    console.log(result.success ? `✓ ${result.message}` : `✗ ${result.message}`)
    process.exit(result.success ? 0 : 1)
  }

  // Default: interactive wizard
  await wizard()
}

runCli().catch(err => { console.error(err); process.exit(1) })
