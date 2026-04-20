import https from 'https'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { TELEGRAM_BOT_TOKEN } from './config.js'
import { logger } from './logger.js'

export interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  file_path?: string
}

export interface MediaMessage {
  type: 'photo' | 'document' | 'voice' | 'audio' | 'video' | 'sticker'
  caption?: string
  buffer?: Buffer
  mimeType?: string
  fileName?: string
}

// ---------- Telegram file download ----------

async function getFilePath(fileId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    https.get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const data = JSON.parse(Buffer.concat(chunks).toString())
        if (!data.ok) reject(new Error(`getFile failed: ${JSON.stringify(data)}`))
        else resolve(data.result.file_path as string)
      })
    }).on('error', reject)
  })
}

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const filePath = await getFilePath(fileId)
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`

  return new Promise((resolve, reject) => {
    https.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

/**
 * Download a Telegram file and save it to a local path.
 * Returns the resolved local path.
 */
export async function saveTelegramFile(fileId: string, destDir: string, baseName?: string): Promise<string> {
  const filePath = await getFilePath(fileId)
  const ext = path.extname(filePath) || ''
  const name = baseName ? `${baseName}${ext}` : path.basename(filePath)
  const dest = path.join(destDir, name)

  const buf = await downloadTelegramFile(fileId)
  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(dest, buf)
  logger.debug({ dest, bytes: buf.length }, 'Saved Telegram file')
  return dest
}

// ---------- Message builders ----------

/**
 * Extract a MediaMessage from a Telegram message object.
 * Downloads the file buffer inline if possible.
 */
export async function extractMediaMessage(msg: Record<string, any>): Promise<MediaMessage | null> {
  if (msg['voice']) {
    const v = msg['voice'] as TelegramFile & { mime_type?: string }
    const buf = await downloadTelegramFile(v.file_id).catch(() => undefined)
    return { type: 'voice', mimeType: v.mime_type ?? 'audio/ogg', buffer: buf }
  }

  if (msg['audio']) {
    const a = msg['audio'] as TelegramFile & { mime_type?: string; file_name?: string }
    const buf = await downloadTelegramFile(a.file_id).catch(() => undefined)
    return { type: 'audio', mimeType: a.mime_type, fileName: a.file_name, buffer: buf }
  }

  if (msg['photo']) {
    const photos = msg['photo'] as TelegramFile[]
    const largest = photos[photos.length - 1]!
    const buf = await downloadTelegramFile(largest.file_id).catch(() => undefined)
    return { type: 'photo', caption: msg['caption'] as string | undefined, mimeType: 'image/jpeg', buffer: buf }
  }

  if (msg['document']) {
    const d = msg['document'] as TelegramFile & { mime_type?: string; file_name?: string }
    const buf = await downloadTelegramFile(d.file_id).catch(() => undefined)
    return { type: 'document', caption: msg['caption'] as string | undefined, mimeType: d.mime_type, fileName: d.file_name, buffer: buf }
  }

  if (msg['video']) {
    const v = msg['video'] as TelegramFile & { mime_type?: string }
    return { type: 'video', caption: msg['caption'] as string | undefined, mimeType: v.mime_type }
  }

  if (msg['sticker']) {
    const s = msg['sticker'] as TelegramFile & { emoji?: string }
    return { type: 'sticker', caption: s.emoji }
  }

  return null
}

export function buildPhotoMessage(buffer: Buffer, caption?: string): { photo: Buffer; caption?: string } {
  return { photo: buffer, ...(caption ? { caption } : {}) }
}

export function buildDocumentMessage(buffer: Buffer, filename: string, caption?: string): { document: Buffer; filename: string; caption?: string } {
  return { document: buffer, filename, ...(caption ? { caption } : {}) }
}

export function describeMedia(media: MediaMessage): string {
  switch (media.type) {
    case 'voice': return '[Voice message]'
    case 'audio': return `[Audio: ${media.fileName ?? 'file'}]`
    case 'photo': return `[Photo${media.caption ? `: ${media.caption}` : ''}]`
    case 'document': return `[Document: ${media.fileName ?? 'file'}${media.caption ? ` — ${media.caption}` : ''}]`
    case 'video': return `[Video${media.caption ? `: ${media.caption}` : ''}]`
    case 'sticker': return `[Sticker ${media.caption ?? ''}]`
    default: return '[Media]'
  }
}
