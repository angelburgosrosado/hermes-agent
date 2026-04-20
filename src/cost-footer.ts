export type CostFooterMode = 'compact' | 'verbose' | 'cost' | 'full' | 'off'

// Approximate costs per 1M tokens (input/output) in USD
const MODEL_COSTS: Record<string, [number, number]> = {
  'claude-opus': [15, 75],
  'claude-sonnet': [3, 15],
  'claude-haiku': [0.25, 1.25],
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function stripModelSuffix(model: string): string {
  return model
    .replace(/^claude-/i, '')
    .replace(/-\d{8}$/, '')
    .replace(/-\d{5,}$/, '')
    .replace(/claude-/gi, '')
    .split('-').slice(0, 2).join('-')
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(MODEL_COSTS).find(k => model.toLowerCase().includes(k.replace('claude-', '')))
  if (!key) return 0
  const [inRate, outRate] = MODEL_COSTS[key]
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate
}

export function formatCostFooter(
  model: string,
  inputTokens: number,
  outputTokens: number,
  mode: CostFooterMode = 'compact'
): string {
  if (mode === 'off') return ''
  const shortModel = stripModelSuffix(model || 'claude')
  if (mode === 'compact') return `\n<i>[${shortModel}]</i>`

  const parts = [shortModel]
  if (mode === 'verbose' || mode === 'full') {
    parts.push(`${formatTokens(inputTokens)} in / ${formatTokens(outputTokens)} out`)
  }
  if (mode === 'cost' || mode === 'full') {
    const cost = estimateCost(model, inputTokens, outputTokens)
    if (cost > 0) parts.push(`~$${cost.toFixed(3)}`)
  }
  return `\n<i>[${parts.join(' | ')}]</i>`
}
