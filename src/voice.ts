import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { GROQ_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, KOKORO_URL, STT_GROQ_MODEL } from './config.js'
import { logger } from './logger.js'

const execFileAsync = promisify(execFile)

// ---------- STT ----------

export type STTProvider = 'groq' | 'whisper-cpp' | 'none'

/**
 * Transcribe an audio buffer (ogg/opus or webm) using Groq Whisper.
 * Falls back to local whisper-cpp if Groq fails.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  if (GROQ_API_KEY) {
    try {
      return await transcribeGroq(audioBuffer, mimeType)
    } catch (err) {
      logger.warn({ err }, 'Groq STT failed — trying whisper-cpp fallback')
    }
  }

  // whisper-cpp fallback
  try {
    return await transcribeWhisperCpp(audioBuffer)
  } catch (err) {
    logger.error({ err }, 'whisper-cpp STT also failed')
    return ''
  }
}

async function transcribeGroq(audioBuffer: Buffer, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now().toString(16)}`
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg'
    const filename = `audio.${ext}`

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    )
    const modelPart = Buffer.from(
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `${STT_GROQ_MODEL}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n` +
      `--${boundary}--\r\n`
    )
    const body = Buffer.concat([header, audioBuffer, modelPart])

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        if (res.statusCode !== 200) {
          reject(new Error(`Groq STT ${res.statusCode}: ${text}`))
        } else {
          resolve(text.trim())
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function transcribeWhisperCpp(audioBuffer: Buffer): Promise<string> {
  // Write buffer to a temp file, call whisper-cpp, return transcript
  const tmpFile = `/tmp/claudeclaw_audio_${Date.now()}.ogg`
  try {
    fs.writeFileSync(tmpFile, audioBuffer)
    const { stdout } = await execFileAsync('whisper', ['-f', tmpFile, '--output-txt', '-'], { timeout: 30_000 })
    return stdout.trim()
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

// ---------- TTS ----------

export type TTSProvider = 'elevenlabs' | 'kokoro' | 'say' | 'none'

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID) {
    try { return await ttsElevenLabs(text) } catch (err) { logger.warn({ err }, 'ElevenLabs TTS failed') }
  }
  if (KOKORO_URL) {
    try { return await ttsKokoro(text) } catch (err) { logger.warn({ err }, 'Kokoro TTS failed') }
  }
  // macOS `say` fallback — produces AIFF
  try { return await ttsSay(text) } catch (err) { logger.warn({ err }, 'say TTS failed') }
  return null
}

async function ttsElevenLabs(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    })

    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ElevenLabs TTS ${res.statusCode}: ${Buffer.concat(chunks).toString()}`))
        } else {
          resolve(Buffer.concat(chunks))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function ttsKokoro(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text, voice: 'af_sky', speed: 1.0 })
    const url = new URL(KOKORO_URL.endsWith('/') ? `${KOKORO_URL}tts` : `${KOKORO_URL}/tts`)
    const mod = url.protocol === 'https:' ? https : http

    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Kokoro TTS ${res.statusCode}`))
        } else {
          resolve(Buffer.concat(chunks))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function ttsSay(text: string): Promise<Buffer> {
  const outFile = `/tmp/claudeclaw_tts_${Date.now()}.aiff`
  try {
    await execFileAsync('say', ['-o', outFile, text], { timeout: 15_000 })
    return fs.readFileSync(outFile)
  } finally {
    try { fs.unlinkSync(outFile) } catch { /* ignore */ }
  }
}

export function detectTTSProvider(): TTSProvider {
  if (ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID) return 'elevenlabs'
  if (KOKORO_URL) return 'kokoro'
  if (process.platform === 'darwin') return 'say'
  return 'none'
}

export function detectSTTProvider(): STTProvider {
  if (GROQ_API_KEY) return 'groq'
  try { execFile('whisper', ['--help'], () => {}); return 'whisper-cpp' } catch { /* ignore */ }
  return 'none'
}
