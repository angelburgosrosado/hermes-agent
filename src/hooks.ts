export type HookPhase = 'pre_message' | 'post_message'

export interface HookContext {
  chatId: string
  agentId: string
  message: string
  response?: string
  blocked?: boolean
}

export interface Hook {
  phase: HookPhase
  name: string
  handler: (ctx: HookContext) => Promise<void>
}

const _hooks: Hook[] = []

export function registerHook(hook: Hook): void {
  _hooks.push(hook)
}

export async function runHooks(phase: HookPhase, ctx: HookContext): Promise<HookContext> {
  for (const hook of _hooks.filter(h => h.phase === phase)) {
    try { await hook.handler(ctx) } catch { /* hooks must not crash the pipeline */ }
    if (ctx.blocked) break
  }
  return ctx
}
