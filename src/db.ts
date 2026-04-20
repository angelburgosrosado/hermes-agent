import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DB_PATH = path.join(__dirname, '..', 'store', 'claudeclaw.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.')
  return _db
}

const ENCRYPTION_KEY = process.env['DB_ENCRYPTION_KEY'] ?? 'claudeclaw-default-key-change-me!'

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, 'claudeclaw-salt', 32)
}

export function encryptField(value: string): string {
  const key = deriveKey(ENCRYPTION_KEY)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptField(value: string): string {
  try {
    const buf = Buffer.from(value, 'base64')
    const key = deriveKey(ENCRYPTION_KEY)
    const iv = buf.subarray(0, 16)
    const tag = buf.subarray(16, 32)
    const encrypted = buf.subarray(32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    return value
  }
}

export function initDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  _db = db

  db.exec(`
    -- Sessions (composite key: chat_id + agent_id)
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id TEXT NOT NULL,
      agent_id TEXT NOT NULL DEFAULT 'main',
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (chat_id, agent_id)
    );

    -- Conversation log
    CREATE TABLE IF NOT EXISTS conversation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      agent_id TEXT DEFAULT 'main',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_log_chat ON conversation_log(chat_id, created_at DESC);

    -- Token usage
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      agent_id TEXT DEFAULT 'main',
      model TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_chat ON token_usage(chat_id, created_at DESC);

    -- Memory v2
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      agent_id TEXT DEFAULT 'main',
      source TEXT,
      raw_text TEXT,
      summary TEXT,
      entities TEXT,
      topics TEXT,
      connections TEXT,
      importance REAL NOT NULL DEFAULT 0.5,
      salience INTEGER NOT NULL DEFAULT 0,
      consolidated INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      embedding BLOB,
      superseded_by INTEGER,
      created_at INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_chat ON memories(chat_id, importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(chat_id, accessed_at DESC);

    -- FTS5 for memory search
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      summary, raw_text,
      content=memories, content_rowid=id
    );
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, summary, raw_text) VALUES (new.id, new.summary, new.raw_text);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text) VALUES ('delete', old.id, old.summary, old.raw_text);
    END;
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF summary, raw_text ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, summary, raw_text) VALUES ('delete', old.id, old.summary, old.raw_text);
      INSERT INTO memories_fts(rowid, summary, raw_text) VALUES (new.id, new.summary, new.raw_text);
    END;

    -- Memory consolidations
    CREATE TABLE IF NOT EXISTS consolidations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      insight TEXT,
      connections TEXT,
      contradictions TEXT,
      source_memory_ids TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Scheduled tasks (Mission Control)
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule TEXT NOT NULL,
      next_run INTEGER NOT NULL,
      last_run INTEGER,
      last_result TEXT,
      priority INTEGER NOT NULL DEFAULT 3,
      agent_id TEXT NOT NULL DEFAULT 'main',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','running','completed','failed')),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_run ON scheduled_tasks(status, priority, next_run);

    -- Mission tasks queue
    CREATE TABLE IF NOT EXISTS mission_tasks (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- Hive mind (cross-agent activity)
    CREATE TABLE IF NOT EXISTS hive_mind (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hive_mind ON hive_mind(agent_id, created_at DESC);

    -- Inter-agent tasks
    CREATE TABLE IF NOT EXISTS inter_agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      prompt TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- Audit log (security)
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      details TEXT,
      chat_id TEXT,
      created_at INTEGER NOT NULL
    );

    -- WhatsApp messages (encrypted)
    CREATE TABLE IF NOT EXISTS wa_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id TEXT UNIQUE,
      chat_id TEXT NOT NULL,
      from_number TEXT NOT NULL,
      body TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    );

    -- WhatsApp outbox
    CREATE TABLE IF NOT EXISTS wa_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_number TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      sent_at INTEGER
    );

    -- WhatsApp message ID map
    CREATE TABLE IF NOT EXISTS wa_message_map (
      wa_id TEXT PRIMARY KEY,
      tg_message_id INTEGER,
      created_at INTEGER NOT NULL
    );

    -- War Room transcripts
    CREATE TABLE IF NOT EXISTS warroom_transcript (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT,
      speaker TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Meeting sessions
    CREATE TABLE IF NOT EXISTS meet_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_url TEXT NOT NULL,
      meeting_title TEXT,
      briefing TEXT,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- Skill health tracking
    CREATE TABLE IF NOT EXISTS skill_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_msg TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Skill usage stats
    CREATE TABLE IF NOT EXISTS skill_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      chat_id TEXT,
      created_at INTEGER NOT NULL
    );

    -- Session summaries
    CREATE TABLE IF NOT EXISTS session_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      agent_id TEXT DEFAULT 'main',
      summary TEXT NOT NULL,
      turn_count INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Compaction events
    CREATE TABLE IF NOT EXISTS compaction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      agent_id TEXT DEFAULT 'main',
      tokens_before INTEGER,
      tokens_after INTEGER,
      created_at INTEGER NOT NULL
    );
  `)

  // Inline migrations — add columns if missing
  _addColumnIfMissing(db, 'memories', 'salience', 'INTEGER NOT NULL DEFAULT 0')
  _addColumnIfMissing(db, 'memories', 'connections', 'TEXT')
  _addColumnIfMissing(db, 'scheduled_tasks', 'priority', 'INTEGER NOT NULL DEFAULT 3')
  _addColumnIfMissing(db, 'scheduled_tasks', 'agent_id', "TEXT NOT NULL DEFAULT 'main'")
  _addColumnIfMissing(db, 'scheduled_tasks', 'name', 'TEXT')
  _addColumnIfMissing(db, 'mission_tasks', 'title', 'TEXT')
  _addColumnIfMissing(db, 'mission_tasks', 'description', 'TEXT')
  _addColumnIfMissing(db, 'mission_tasks', 'notes', 'TEXT')
  _addColumnIfMissing(db, 'mission_tasks', 'due_at', 'INTEGER')
  _addColumnIfMissing(db, 'mission_tasks', 'priority_label', "TEXT NOT NULL DEFAULT 'medium'")

  return db
}

function _addColumnIfMissing(db: Database.Database, table: string, col: string, def: string): void {
  const cols = (db.pragma(`table_info(${table})`) as { name: string }[]).map(c => c.name)
  if (!cols.includes(col)) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch { /* ok */ }
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSession(chatId: string, agentId = 'main'): string | null {
  const row = getDb().prepare('SELECT session_id FROM sessions WHERE chat_id=? AND agent_id=?').get(chatId, agentId) as { session_id: string } | undefined
  return row?.session_id ?? null
}

export function setSession(chatId: string, sessionId: string, agentId = 'main'): void {
  getDb().prepare('INSERT OR REPLACE INTO sessions(chat_id,agent_id,session_id,updated_at) VALUES(?,?,?,?)').run(chatId, agentId, sessionId, Date.now())
}

export function clearSession(chatId: string, agentId?: string): void {
  if (agentId) {
    getDb().prepare('DELETE FROM sessions WHERE chat_id=? AND agent_id=?').run(chatId, agentId)
  } else {
    getDb().prepare('DELETE FROM sessions WHERE chat_id=?').run(chatId)
  }
}

// ─── Conversation Log ────────────────────────────────────────────────────────

export function logConversation(chatId: string, role: string, content: string, agentId = 'main'): void {
  getDb().prepare('INSERT INTO conversation_log(chat_id,agent_id,role,content,created_at) VALUES(?,?,?,?,?)').run(chatId, agentId, role, content, Date.now())
}

export function getRecentConversation(chatId: string, limit = 10, agentId = 'main'): { role: string; content: string }[] {
  return getDb().prepare('SELECT role,content FROM conversation_log WHERE chat_id=? AND agent_id=? ORDER BY created_at DESC LIMIT ?').all(chatId, agentId, limit) as { role: string; content: string }[]
}

export function getConversationChats(): { chat_id: string; msg_count: number; last_at: number; preview: string }[] {
  return getDb().prepare(`
    SELECT c.chat_id,
           COUNT(*) as msg_count,
           MAX(c.created_at) as last_at,
           (SELECT content FROM conversation_log c2 WHERE c2.chat_id=c.chat_id ORDER BY created_at DESC LIMIT 1) as preview
    FROM conversation_log c
    GROUP BY c.chat_id
    ORDER BY last_at DESC
  `).all() as { chat_id: string; msg_count: number; last_at: number; preview: string }[]
}

export function getConversationHistoryPaged(chatId: string, limit = 60, offset = 0): { id: number; role: string; content: string; agent_id: string; created_at: number }[] {
  return getDb().prepare(`
    SELECT id, role, content, agent_id, created_at
    FROM conversation_log
    WHERE chat_id=?
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(chatId, limit, offset) as { id: number; role: string; content: string; agent_id: string; created_at: number }[]
}

// ─── Token Usage ─────────────────────────────────────────────────────────────

export function logTokenUsage(chatId: string, agentId: string, model: string, inputTokens: number, outputTokens: number, estimatedCost?: number): void {
  getDb().prepare('INSERT INTO token_usage(chat_id,agent_id,model,input_tokens,output_tokens,estimated_cost,created_at) VALUES(?,?,?,?,?,?,?)').run(chatId, agentId, model, inputTokens, outputTokens, estimatedCost ?? null, Date.now())
}

export function getTokenStats(chatId?: string): { total_input: number; total_output: number; total_cost: number } {
  const q = chatId
    ? 'SELECT SUM(input_tokens) as total_input,SUM(output_tokens) as total_output,SUM(estimated_cost) as total_cost FROM token_usage WHERE chat_id=?'
    : 'SELECT SUM(input_tokens) as total_input,SUM(output_tokens) as total_output,SUM(estimated_cost) as total_cost FROM token_usage'
  const row = (chatId ? getDb().prepare(q).get(chatId) : getDb().prepare(q).get()) as { total_input: number; total_output: number; total_cost: number } | undefined
  return row ?? { total_input: 0, total_output: 0, total_cost: 0 }
}

// ─── Memory v2 ───────────────────────────────────────────────────────────────

export interface MemoryRow {
  id: number
  chat_id: string
  agent_id: string
  summary: string
  raw_text: string
  entities: string
  topics: string
  importance: number
  salience: number
  pinned: number
  consolidated: number
  embedding: Buffer | null
  superseded_by: number | null
  created_at: number
  accessed_at: number
}

export function saveMemory(m: Omit<MemoryRow, 'id'>): number {
  const result = getDb().prepare(`
    INSERT INTO memories(chat_id,agent_id,source,raw_text,summary,entities,topics,importance,salience,consolidated,pinned,embedding,superseded_by,created_at,accessed_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(m.chat_id, m.agent_id, 'conversation', m.raw_text, m.summary, m.entities, m.topics, m.importance, m.salience, 0, m.pinned, m.embedding, m.superseded_by, m.created_at, m.accessed_at)
  return result.lastInsertRowid as number
}

export function getMemoriesForChat(chatId: string, limit = 20): MemoryRow[] {
  return getDb().prepare('SELECT * FROM memories WHERE chat_id=? AND superseded_by IS NULL ORDER BY importance DESC, accessed_at DESC LIMIT ?').all(chatId, limit) as MemoryRow[]
}

export function getHighImportanceMemories(chatId: string, minImportance = 0.7, limit = 5): MemoryRow[] {
  return getDb().prepare('SELECT * FROM memories WHERE chat_id=? AND importance>=? AND pinned=0 AND superseded_by IS NULL ORDER BY accessed_at DESC LIMIT ?').all(chatId, minImportance, limit) as MemoryRow[]
}

export function getUnconsolidatedMemories(chatId: string, limit = 20): MemoryRow[] {
  return getDb().prepare('SELECT * FROM memories WHERE chat_id=? AND consolidated=0 AND pinned=0 ORDER BY created_at DESC LIMIT ?').all(chatId, limit) as MemoryRow[]
}

export function markMemoriesConsolidated(ids: number[]): void {
  const stmt = getDb().prepare('UPDATE memories SET consolidated=1 WHERE id=?')
  const tx = getDb().transaction((ids: number[]) => { for (const id of ids) stmt.run(id) })
  tx(ids)
}

export function touchMemory(id: number): void {
  getDb().prepare('UPDATE memories SET accessed_at=? WHERE id=?').run(Date.now(), id)
}

export function supersedMemory(oldId: number, newId: number): void {
  getDb().prepare('UPDATE memories SET superseded_by=? WHERE id=?').run(newId, oldId)
}

export function pinMemory(id: number, pinned: boolean): void {
  getDb().prepare('UPDATE memories SET pinned=? WHERE id=?').run(pinned ? 1 : 0, id)
}

export function searchMemoriesFts(chatId: string, query: string, limit = 5): MemoryRow[] {
  return getDb().prepare(`
    SELECT m.* FROM memories m
    JOIN memories_fts f ON m.id = f.rowid
    WHERE m.chat_id=? AND memories_fts MATCH ?
    ORDER BY rank LIMIT ?
  `).all(chatId, query, limit) as MemoryRow[]
}

export function getAllMemoryEmbeddings(chatId: string): { id: number; embedding: Buffer }[] {
  return getDb().prepare('SELECT id, embedding FROM memories WHERE chat_id=? AND embedding IS NOT NULL AND superseded_by IS NULL').all(chatId) as { id: number; embedding: Buffer }[]
}

export function getMemoryById(id: number): MemoryRow | undefined {
  return getDb().prepare('SELECT * FROM memories WHERE id=?').get(id) as MemoryRow | undefined
}

export function deleteOldLowImportanceMemories(chatId: string, maxAgeDays = 30, maxImportance = 0.3): void {
  const cutoff = Date.now() - maxAgeDays * 86400000
  getDb().prepare('DELETE FROM memories WHERE chat_id=? AND importance<=? AND pinned=0 AND accessed_at<?').run(chatId, maxImportance, cutoff)
}

// ─── Consolidations ──────────────────────────────────────────────────────────

export function saveConsolidation(chatId: string, summary: string, insight: string, connections: string, contradictions: string, sourceIds: number[]): void {
  getDb().prepare('INSERT INTO consolidations(chat_id,summary,insight,connections,contradictions,source_memory_ids,created_at) VALUES(?,?,?,?,?,?,?)').run(chatId, summary, insight, connections, contradictions, JSON.stringify(sourceIds), Date.now())
}

export function getRecentConsolidations(chatId: string, limit = 3): { summary: string; insight: string; contradictions: string }[] {
  return getDb().prepare('SELECT summary,insight,contradictions FROM consolidations WHERE chat_id=? ORDER BY created_at DESC LIMIT ?').all(chatId, limit) as { summary: string; insight: string; contradictions: string }[]
}

export function getRecentConsolidationsGlobal(limit = 5): { chat_id: string; summary: string; insight: string; created_at: number }[] {
  return getDb().prepare('SELECT chat_id,summary,insight,created_at FROM consolidations ORDER BY created_at DESC LIMIT ?').all(limit) as { chat_id: string; summary: string; insight: string; created_at: number }[]
}

// ─── Memory Stats ─────────────────────────────────────────────────────────────

export interface MemoryStats {
  total: number
  pinned: number
  unconsolidated: number
  avgImportance: number
  chatCount: number
}

export function getMemoryStats(): MemoryStats {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(pinned) as pinned,
      SUM(CASE WHEN consolidated=0 THEN 1 ELSE 0 END) as unconsolidated,
      AVG(importance) as avg_importance,
      COUNT(DISTINCT chat_id) as chat_count
    FROM memories
    WHERE superseded_by IS NULL
  `).get() as { total: number; pinned: number; unconsolidated: number; avg_importance: number; chat_count: number }
  return {
    total: row?.total ?? 0,
    pinned: row?.pinned ?? 0,
    unconsolidated: row?.unconsolidated ?? 0,
    avgImportance: row?.avg_importance ?? 0,
    chatCount: row?.chat_count ?? 0,
  }
}

export function getTopMemories(limit = 10): Pick<MemoryRow, 'id' | 'chat_id' | 'summary' | 'importance' | 'pinned' | 'created_at'>[] {
  return getDb().prepare(`
    SELECT id, chat_id, summary, importance, pinned, created_at
    FROM memories
    WHERE superseded_by IS NULL AND summary IS NOT NULL AND summary != ''
    ORDER BY importance DESC, accessed_at DESC
    LIMIT ?
  `).all(limit) as Pick<MemoryRow, 'id' | 'chat_id' | 'summary' | 'importance' | 'pinned' | 'created_at'>[]
}

// ─── Hive Mind ───────────────────────────────────────────────────────────────

export function logToHiveMind(agentId: string, actionType: string, summary: string, metadata?: Record<string, unknown>): void {
  getDb().prepare('INSERT INTO hive_mind(agent_id,action_type,summary,metadata,created_at) VALUES(?,?,?,?,?)').run(agentId, actionType, summary, metadata ? JSON.stringify(metadata) : null, Date.now())
}

export function getRecentHiveMind(limit = 10): { agent_id: string; action_type: string; summary: string; created_at: number }[] {
  return getDb().prepare('SELECT agent_id,action_type,summary,created_at FROM hive_mind ORDER BY created_at DESC LIMIT ?').all(limit) as { agent_id: string; action_type: string; summary: string; created_at: number }[]
}

// ─── Scheduled Tasks ─────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string
  chat_id: string
  prompt: string
  schedule: string
  next_run: number
  last_run: number | null
  last_result: string | null
  priority: number
  agent_id: string
  status: string
  created_at: number
}

export function createTask(task: Omit<ScheduledTask, 'last_run' | 'last_result'>): void {
  getDb().prepare('INSERT OR REPLACE INTO scheduled_tasks(id,chat_id,prompt,schedule,next_run,priority,agent_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(task.id, task.chat_id, task.prompt, task.schedule, task.next_run, task.priority, task.agent_id, task.status, task.created_at)
}

export function getDueTasks(): ScheduledTask[] {
  return getDb().prepare("SELECT * FROM scheduled_tasks WHERE status='active' AND next_run<=? ORDER BY priority ASC, next_run ASC").all(Date.now()) as ScheduledTask[]
}

export function getAllTasks(): ScheduledTask[] {
  return getDb().prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as ScheduledTask[]
}

export function updateTaskAfterRun(id: string, nextRun: number, result: string): void {
  getDb().prepare("UPDATE scheduled_tasks SET last_run=?,next_run=?,last_result=?,status='active' WHERE id=?").run(Date.now(), nextRun, result.slice(0, 500), id)
}

export function setTaskStatus(id: string, status: string): void {
  getDb().prepare('UPDATE scheduled_tasks SET status=? WHERE id=?').run(status, id)
}

export function deleteTask(id: string): void {
  getDb().prepare('DELETE FROM scheduled_tasks WHERE id=?').run(id)
}

// ─── Mission Tasks ───────────────────────────────────────────────────────────

export interface MissionTask {
  id: string
  chat_id: string
  agent_id: string | null
  prompt: string
  title: string | null
  description: string | null
  notes: string | null
  priority: number
  priority_label: string
  status: string
  result: string | null
  due_at: number | null
  created_at: number
  completed_at: number | null
}

let _missionSeq = 0

export function createMissionTask(opts: {
  title: string
  description?: string
  agent_id?: string | null
  priority?: string
  status?: string
  due_at?: number | null
}): MissionTask {
  const id = `mission-${Date.now()}-${++_missionSeq}`
  const now = Date.now()
  const priorityNum = { critical: 1, high: 2, medium: 3, low: 4 }[opts.priority ?? 'medium'] ?? 3
  getDb().prepare(`
    INSERT INTO mission_tasks(id,chat_id,agent_id,prompt,title,description,priority,priority_label,status,due_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, 'system', opts.agent_id ?? null, opts.title, opts.title, opts.description ?? null, priorityNum, opts.priority ?? 'medium', opts.status ?? 'pending', opts.due_at ?? null, now)
  return getMissionTask(id)!
}

export function getMissionTask(id: string): MissionTask | undefined {
  return getDb().prepare('SELECT * FROM mission_tasks WHERE id=?').get(id) as MissionTask | undefined
}

export function getMissionTasks(filters?: { status?: string; agent_id?: string }): MissionTask[] {
  let q = 'SELECT * FROM mission_tasks WHERE 1=1'
  const params: unknown[] = []
  if (filters?.status) { q += ' AND status=?'; params.push(filters.status) }
  if (filters?.agent_id) { q += ' AND agent_id=?'; params.push(filters.agent_id) }
  q += ' ORDER BY priority ASC, created_at DESC'
  return getDb().prepare(q).all(...params) as MissionTask[]
}

export function updateMissionTask(id: string, updates: Partial<Pick<MissionTask, 'status' | 'notes' | 'agent_id' | 'priority_label' | 'result'>>): void {
  const sets: string[] = []
  const params: unknown[] = []
  if (updates.status !== undefined) { sets.push('status=?'); params.push(updates.status) }
  if (updates.notes !== undefined) { sets.push('notes=?'); params.push(updates.notes) }
  if (updates.agent_id !== undefined) { sets.push('agent_id=?'); params.push(updates.agent_id) }
  if (updates.priority_label !== undefined) {
    const n = { critical: 1, high: 2, medium: 3, low: 4 }[updates.priority_label] ?? 3
    sets.push('priority_label=?', 'priority=?')
    params.push(updates.priority_label, n)
  }
  if (updates.result !== undefined) { sets.push('result=?'); params.push(updates.result) }
  if (updates.status === 'done') { sets.push('completed_at=?'); params.push(Date.now()) }
  if (sets.length === 0) return
  params.push(id)
  getDb().prepare(`UPDATE mission_tasks SET ${sets.join(',')} WHERE id=?`).run(...params)
}

export function deleteMissionTask(id: string): void {
  getDb().prepare('DELETE FROM mission_tasks WHERE id=?').run(id)
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export function logAuditEvent(eventType: string, details?: string, chatId?: string): void {
  getDb().prepare('INSERT INTO audit_log(event_type,details,chat_id,created_at) VALUES(?,?,?,?)').run(eventType, details ?? null, chatId ?? null, Date.now())
}

export function getRecentAuditLog(limit = 50): { event_type: string; details: string; chat_id: string; created_at: number }[] {
  return getDb().prepare('SELECT event_type,details,chat_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit) as { event_type: string; details: string; chat_id: string; created_at: number }[]
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export function saveWaMessage(waId: string, chatId: string, fromNumber: string, body: string, timestamp: number): void {
  getDb().prepare('INSERT OR IGNORE INTO wa_messages(wa_id,chat_id,from_number,body,timestamp,read) VALUES(?,?,?,?,?,0)').run(waId, chatId, fromNumber, encryptField(body), timestamp)
}

export function queueWaOutbox(toNumber: string, body: string): void {
  getDb().prepare("INSERT INTO wa_outbox(to_number,body,status,created_at) VALUES(?,?,'pending',?)").run(toNumber, encryptField(body), Date.now())
}

export function getPendingWaOutbox(): { id: number; to_number: string; body: string }[] {
  const rows = getDb().prepare("SELECT id,to_number,body FROM wa_outbox WHERE status='pending' ORDER BY created_at LIMIT 10").all() as { id: number; to_number: string; body: string }[]
  return rows.map(r => ({ ...r, body: decryptField(r.body) }))
}

export function markWaSent(id: number): void {
  getDb().prepare("UPDATE wa_outbox SET status='sent',sent_at=? WHERE id=?").run(Date.now(), id)
}

// ─── War Room ────────────────────────────────────────────────────────────────

export function saveWarRoomTranscript(agentId: string, speaker: string, content: string): void {
  getDb().prepare('INSERT INTO warroom_transcript(agent_id,speaker,content,created_at) VALUES(?,?,?,?)').run(agentId, speaker, content, Date.now())
}

// ─── Meet Sessions ───────────────────────────────────────────────────────────

export interface MeetSession {
  id: number
  meeting_url: string
  meeting_title: string | null
  briefing: string | null
  summary: string | null
  status: string
  created_at: number
  completed_at: number | null
}

export function createMeetSession(meetingUrl: string, meetingTitle?: string): number {
  const result = getDb().prepare(
    'INSERT INTO meet_sessions(meeting_url,meeting_title,status,created_at) VALUES(?,?,?,?)'
  ).run(meetingUrl, meetingTitle ?? null, 'pending', Date.now())
  return result.lastInsertRowid as number
}

export function getMeetSession(id: number): MeetSession | undefined {
  return getDb().prepare('SELECT * FROM meet_sessions WHERE id=?').get(id) as MeetSession | undefined
}

export function getRecentMeetSessions(limit = 10): MeetSession[] {
  return getDb().prepare('SELECT * FROM meet_sessions ORDER BY created_at DESC LIMIT ?').all(limit) as MeetSession[]
}

export function updateMeetSession(id: number, updates: Partial<Pick<MeetSession, 'briefing' | 'summary' | 'status' | 'meeting_title'>>): void {
  const sets: string[] = []
  const params: unknown[] = []
  if (updates.briefing !== undefined) { sets.push('briefing=?'); params.push(updates.briefing) }
  if (updates.summary !== undefined) { sets.push('summary=?'); params.push(updates.summary) }
  if (updates.status !== undefined) { sets.push('status=?'); params.push(updates.status) }
  if (updates.meeting_title !== undefined) { sets.push('meeting_title=?'); params.push(updates.meeting_title) }
  if (updates.status === 'completed') { sets.push('completed_at=?'); params.push(Date.now()) }
  if (sets.length === 0) return
  params.push(id)
  getDb().prepare(`UPDATE meet_sessions SET ${sets.join(',')} WHERE id=?`).run(...params)
}

export function decayMemorySalience(chatId: string, decayFactor = 0.95, minSalience = 0): void {
  getDb().prepare(`
    UPDATE memories
    SET salience = MAX(?, CAST(salience * ? AS INTEGER))
    WHERE chat_id = ? AND pinned = 0 AND superseded_by IS NULL
  `).run(minSalience, decayFactor, chatId)
}

// ─── Skill Health ────────────────────────────────────────────────────────────

export function logSkillHealth(skillName: string, success: boolean, errorMsg?: string, durationMs?: number): void {
  getDb().prepare('INSERT INTO skill_health(skill_name,success,error_msg,duration_ms,created_at) VALUES(?,?,?,?,?)').run(skillName, success ? 1 : 0, errorMsg ?? null, durationMs ?? null, Date.now())
}
