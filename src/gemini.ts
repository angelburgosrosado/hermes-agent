import https from 'https'
import { GOOGLE_API_KEY } from './config.js'

const GEMINI_BASE = 'generativelanguage.googleapis.com'

async function post(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request(
      { hostname: GEMINI_BASE, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let buf = ''
        res.on('data', c => buf += c)
        res.on('end', () => {
          try { resolve(JSON.parse(buf)) } catch { reject(new Error(`Gemini parse error: ${buf.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

export async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const key = GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  }
  if (systemInstruction) {
    body['system_instruction'] = { parts: [{ text: systemInstruction }] }
  }

  const resp = await post(`/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, body) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    error?: { message: string }
  }

  if (resp.error) throw new Error(`Gemini error: ${resp.error.message}`)
  return resp.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function getEmbedding(text: string): Promise<number[]> {
  const key = GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')

  const resp = await post(`/v1beta/models/gemini-embedding-001:embedContent?key=${key}`, {
    model: 'models/gemini-embedding-001',
    content: { parts: [{ text: text.slice(0, 2000) }] },
  }) as { embedding?: { values?: number[] }; error?: { message: string } }

  if (resp.error) throw new Error(`Gemini embedding error: ${resp.error.message}`)
  return resp.embedding?.values ?? []
}
