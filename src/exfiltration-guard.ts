export interface SecretMatch {
  pattern: string
  value: string
  redacted: string
  index: number
}

// Patterns ordered by specificity — most specific first
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Anthropic
  { name: 'anthropic_key', re: /sk-ant-[a-zA-Z0-9\-_]{80,}/g },
  // OpenAI
  { name: 'openai_key', re: /sk-[a-zA-Z0-9]{20,}/g },
  // AWS
  { name: 'aws_access_key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'aws_secret_key', re: /(?<![A-Za-z0-9])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
  // GCP service account
  { name: 'gcp_key', re: /"private_key"\s*:\s*"-----BEGIN[^"]+"/g },
  // Generic private keys (PEM)
  { name: 'pem_private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  // Telegram bot tokens
  { name: 'telegram_token', re: /\d{8,10}:[A-Za-z0-9_\-]{35}/g },
  // Deepgram
  { name: 'deepgram_key', re: /[0-9a-f]{40}(?=[^0-9a-f]|$)/g },
  // Cartesia
  { name: 'cartesia_key', re: /sk_car_[A-Za-z0-9]{20,}/g },
  // GitHub personal access tokens
  { name: 'github_pat', re: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'github_oauth', re: /gho_[A-Za-z0-9]{36}/g },
  { name: 'github_install', re: /ghs_[A-Za-z0-9]{36}/g },
  // Generic Bearer tokens (long)
  { name: 'bearer_token', re: /Bearer\s+[A-Za-z0-9\-._~+/]{40,}/gi },
  // Generic API keys (key= pattern)
  { name: 'api_key_param', re: /(?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key)\s*[:=]\s*['""]?([A-Za-z0-9\-_./+=]{20,})['""]?/gi },
  // Base64-encoded secrets (heuristic: 40+ chars of base64 after common prefixes)
  { name: 'base64_secret', re: /(?:password|passwd|secret|token|key)\s*[:=]\s*['""]?([A-Za-z0-9+/]{40,}={0,2})['""]?/gi },
  // URL-encoded credentials in URLs
  { name: 'url_credentials', re: /https?:\/\/[^:@\s]+:[^:@\s]{8,}@/gi },
  // Connection strings with passwords
  { name: 'connection_string', re: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:([^@\s]{8,})@/gi },
  // JWT tokens
  { name: 'jwt_token', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
]

// Patterns that are safe to ignore (common false positives)
const ALLOWLIST_PATTERNS = [
  /^[0-9a-f]{40}$/, // git SHA
]

function isAllowlisted(value: string): boolean {
  return ALLOWLIST_PATTERNS.some(p => p.test(value))
}

export function scanForSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = []
  const seen = new Set<string>()

  for (const { name, re } of SECRET_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const raw = m[1] ?? m[0]
      if (raw.length < 8) continue
      if (isAllowlisted(raw)) continue
      if (seen.has(raw)) continue
      seen.add(raw)
      matches.push({
        pattern: name,
        value: raw,
        redacted: raw.slice(0, 4) + '...[REDACTED]',
        index: m.index,
      })
    }
  }

  return matches
}

export function redactSecrets(text: string): string {
  let result = text
  const matches = scanForSecrets(text)
  // Replace longest matches first to avoid partial replacements
  matches.sort((a, b) => b.value.length - a.value.length)
  for (const m of matches) {
    result = result.split(m.value).join('[REDACTED]')
  }
  return result
}

export function containsSecrets(text: string): boolean {
  return scanForSecrets(text).length > 0
}
