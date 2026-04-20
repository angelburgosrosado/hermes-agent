export type WarroomPersona = 'hand' | 'fire' | 'wolf' | 'raven'

const PERSONA_NAMES: Record<WarroomPersona, string> = {
  hand: 'The Hand of the King',
  fire: 'Daenerys Stormborn',
  wolf: 'The Warden of the North',
  raven: 'The Three-Eyed Raven',
}

export function getWarroomHtml(persona: WarroomPersona = 'hand'): string {
  const personaName = PERSONA_NAMES[persona] ?? 'The Hand of the King'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>War Room — ${personaName}</title>
<style>
  :root {
    --bg: #06060a; --surface: #0d0f18; --border: #1a1d2e;
    --gold: #c9a227; --gold2: #f0c040; --ember: #c84b11; --ice: #8ab4f8;
    --text: #ddd5c0; --muted: #5a5040; --font: 'Georgia', serif;
    --mono: 'SF Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { background: var(--bg); color: var(--text); font-family: var(--font); height: 100vh; display: flex; flex-direction: column; overflow: hidden }

  /* Intro overlay */
  #intro { position: fixed; inset: 0; background: #000; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity 1.5s }
  #intro.gone { opacity: 0; pointer-events: none }
  .sigil { font-size: 64px; margin-bottom: 16px; animation: glow 2s ease-in-out infinite alternate }
  @keyframes glow { from { text-shadow: 0 0 20px var(--gold) } to { text-shadow: 0 0 60px var(--gold2), 0 0 10px #fff } }
  .war-title { font-size: 28px; letter-spacing: 6px; color: var(--gold); text-transform: uppercase; margin-bottom: 8px }
  .war-sub { font-size: 13px; letter-spacing: 3px; color: var(--muted); text-transform: uppercase }
  .enter-btn { margin-top: 32px; background: transparent; border: 1px solid var(--gold); color: var(--gold); padding: 10px 32px; font-family: var(--font); font-size: 14px; letter-spacing: 3px; cursor: pointer; text-transform: uppercase; transition: all .3s }
  .enter-btn:hover { background: var(--gold); color: #000 }

  /* Main layout */
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; align-items: center; gap: 12px; flex-shrink: 0 }
  .persona-badge { color: var(--gold); font-size: 13px; letter-spacing: 1px }
  .conn-indicator { width: 8px; height: 8px; border-radius: 50%; background: #444; margin-left: auto }
  .conn-indicator.connected { background: var(--gold); box-shadow: 0 0 6px var(--gold) }
  .main { flex: 1; display: flex; overflow: hidden }

  /* Transcript */
  .transcript { flex: 1; display: flex; flex-direction: column; overflow: hidden }
  #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px }
  #messages::-webkit-scrollbar { width: 4px }
  #messages::-webkit-scrollbar-track { background: transparent }
  #messages::-webkit-scrollbar-thumb { background: var(--border) }

  .msg { display: flex; flex-direction: column; max-width: 80% }
  .msg.user { align-self: flex-end; align-items: flex-end }
  .msg.bot { align-self: flex-start; align-items: flex-start }
  .msg-header { font-size: 10px; color: var(--muted); margin-bottom: 3px; letter-spacing: 1px; text-transform: uppercase }
  .msg-body { padding: 10px 14px; border-radius: 2px; font-size: 14px; line-height: 1.7 }
  .msg.user .msg-body { background: rgba(201,162,39,.12); border: 1px solid rgba(201,162,39,.3); color: var(--gold2) }
  .msg.bot .msg-body { background: var(--surface); border: 1px solid var(--border) }
  .msg.system .msg-body { background: rgba(200,75,17,.08); border: 1px solid rgba(200,75,17,.3); color: var(--ember); font-size: 12px; font-family: var(--mono) }
  .msg.system { align-self: center }

  /* Voice visualizer */
  #viz-wrap { height: 48px; display: flex; align-items: center; justify-content: center; gap: 2px; padding: 0 20px; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0 }
  .viz-bar { width: 3px; border-radius: 2px; background: var(--gold); transition: height .05s }

  /* Input row */
  .input-area { padding: 12px 20px; background: var(--surface); border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: center; flex-shrink: 0 }
  .input-area input { flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; font-family: var(--font); font-size: 14px; border-radius: 2px }
  .input-area input:focus { outline: none; border-color: var(--gold) }
  .btn-voice { background: transparent; border: 1px solid var(--gold); color: var(--gold); padding: 8px 16px; font-family: var(--font); font-size: 12px; letter-spacing: 1px; cursor: pointer; border-radius: 2px; transition: all .2s; text-transform: uppercase }
  .btn-voice:hover { background: var(--gold); color: #000 }
  .btn-voice.recording { background: var(--ember); border-color: var(--ember); color: #fff; animation: pulse-btn 1s infinite }
  @keyframes pulse-btn { 0%,100%{opacity:1}50%{opacity:.7} }
  .btn-send { background: var(--gold); border: none; color: #000; padding: 8px 16px; font-family: var(--font); font-size: 12px; cursor: pointer; border-radius: 2px; letter-spacing: 1px; text-transform: uppercase }
  .btn-send:hover { background: var(--gold2) }

  /* Sidebar */
  .sidebar { width: 240px; background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto; padding: 16px; flex-shrink: 0 }
  .side-section { margin-bottom: 20px }
  .side-title { font-size: 10px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 6px }
  .persona-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer; border-radius: 2px; font-size: 12px; color: var(--muted) }
  .persona-item:hover { background: rgba(201,162,39,.08); color: var(--text) }
  .persona-item.active { color: var(--gold) }
  .persona-sigil { font-size: 18px }
  .stat-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px solid rgba(26,29,46,.6) }
  .stat-row .label { color: var(--muted) }
  .stat-row .val { color: var(--gold) }
</style>
</head>
<body>

<!-- Intro overlay -->
<div id="intro">
  <div class="sigil">⚔</div>
  <div class="war-title">War Room</div>
  <div class="war-sub">${personaName}</div>
  <button class="enter-btn" onclick="enterRoom()">Enter the Room</button>
</div>

<header>
  <span class="persona-badge" id="persona-label">${personaName}</span>
  <div class="conn-indicator" id="conn-dot"></div>
</header>

<div class="main">
  <div class="transcript">
    <div id="messages">
      <div class="msg system"><div class="msg-header">System</div><div class="msg-body">War Room initialized. Awaiting counsel.</div></div>
    </div>
    <div id="viz-wrap" id="viz">
      ${Array.from({ length: 24 }, (_, i) => `<div class="viz-bar" id="vb${i}" style="height:4px"></div>`).join('')}
    </div>
    <div class="input-area">
      <button class="btn-voice" id="mic-btn" onclick="toggleVoice()">🎙 Voice</button>
      <input type="text" id="text-input" placeholder="Speak your counsel…" onkeydown="if(event.key==='Enter')sendText()">
      <button class="btn-send" onclick="sendText()">Send</button>
    </div>
  </div>

  <div class="sidebar">
    <div class="side-section">
      <div class="side-title">Persona</div>
      ${Object.entries({ hand: '🖐', fire: '🐉', wolf: '🐺', raven: '🦅' }).map(([p, sig]) =>
        `<div class="persona-item ${p === persona ? 'active' : ''}" onclick="switchPersona('${p}')"><span class="persona-sigil">${sig}</span><span>${PERSONA_NAMES[p as WarroomPersona] ?? p}</span></div>`
      ).join('')}
    </div>
    <div class="side-section">
      <div class="side-title">Session</div>
      <div class="stat-row"><span class="label">Turns</span><span class="val" id="stat-turns">0</span></div>
      <div class="stat-row"><span class="label">Tokens</span><span class="val" id="stat-tokens">—</span></div>
      <div class="stat-row"><span class="label">Status</span><span class="val" id="stat-status">disconnected</span></div>
    </div>
  </div>
</div>

<script>
const PERSONA = '${persona}'
const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/voice?persona=' + PERSONA

let ws = null
let mediaRecorder = null
let isRecording = false
let turns = 0
let totalTokens = 0
let audioCtx = null
let analyser = null
let vizRaf = null

// ── Intro ─────────────────────────────────────────────────────────────────────
function enterRoom() {
  document.getElementById('intro').classList.add('gone')
  connect()
}

// ── WebSocket ────────────────────────────────────────────────────────────────
function connect() {
  ws = new WebSocket(WS_URL)
  ws.onopen = () => {
    setStatus('connected')
    document.getElementById('conn-dot').classList.add('connected')
    addMsg('system', 'Connection established.')
  }
  ws.onclose = () => {
    setStatus('disconnected')
    document.getElementById('conn-dot').classList.remove('connected')
    setTimeout(connect, 3000)
  }
  ws.onerror = () => addMsg('system', 'Connection error.')
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try {
        const d = JSON.parse(ev.data)
        if (d.type === 'transcript') addMsg('bot', d.text, d.tokens)
        else if (d.type === 'interim') showInterim(d.text)
        else if (d.type === 'error') addMsg('system', 'Error: ' + d.message)
      } catch { addMsg('bot', ev.data) }
    } else {
      // Binary = WAV audio
      playAudio(ev.data)
    }
  }
}

// ── Voice recording ──────────────────────────────────────────────────────────
async function toggleVoice() {
  if (isRecording) { stopRecording(); return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 48000, channelCount: 1 } })
    startRecording(stream)
  } catch (err) { addMsg('system', 'Microphone access denied: ' + err.message) }
}

function startRecording(stream) {
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) ws.send(e.data) }
  mediaRecorder.start(100)
  isRecording = true
  document.getElementById('mic-btn').classList.add('recording')
  document.getElementById('mic-btn').textContent = '⏹ Stop'
  startVisualizer(stream)
}

function stopRecording() {
  if (mediaRecorder) { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()) }
  isRecording = false
  document.getElementById('mic-btn').classList.remove('recording')
  document.getElementById('mic-btn').textContent = '🎙 Voice'
  stopVisualizer()
}

// ── Text send ────────────────────────────────────────────────────────────────
function sendText() {
  const input = document.getElementById('text-input')
  const text = input.value.trim()
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'text', text }))
  addMsg('user', text)
  input.value = ''
}

// ── Audio playback ───────────────────────────────────────────────────────────
async function playAudio(data) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const buf = await ctx.decodeAudioData(await (new Blob([data])).arrayBuffer())
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
}

// ── Visualizer ───────────────────────────────────────────────────────────────
function startVisualizer(stream) {
  audioCtx = new AudioContext()
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 64
  const src = audioCtx.createMediaStreamSource(stream)
  src.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  const bars = Array.from({ length: 24 }, (_, i) => document.getElementById('vb' + i))
  function draw() {
    analyser.getByteFrequencyData(data)
    bars.forEach((b, i) => { if (b) b.style.height = Math.max(4, data[i * 2] / 3) + 'px' })
    vizRaf = requestAnimationFrame(draw)
  }
  draw()
}

function stopVisualizer() {
  if (vizRaf) cancelAnimationFrame(vizRaf)
  Array.from({ length: 24 }, (_, i) => document.getElementById('vb' + i)).forEach(b => { if (b) b.style.height = '4px' })
  if (audioCtx) { audioCtx.close(); audioCtx = null }
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function addMsg(who, text, tokens) {
  turns++
  if (tokens) totalTokens += tokens
  document.getElementById('stat-turns').textContent = turns
  document.getElementById('stat-tokens').textContent = totalTokens > 0 ? fmtNum(totalTokens) : '—'

  const msgs = document.getElementById('messages')
  const el = document.createElement('div')
  el.className = 'msg ' + who
  const names = { user: 'You', bot: '${personaName}', system: 'System' }
  el.innerHTML = '<div class="msg-header">' + (names[who] ?? who) + '</div><div class="msg-body">' + escHtml(text) + '</div>'
  msgs.appendChild(el)
  msgs.scrollTop = msgs.scrollHeight
}

let _interimEl = null
function showInterim(text) {
  if (!_interimEl) {
    _interimEl = document.createElement('div')
    _interimEl.className = 'msg system'
    _interimEl.innerHTML = '<div class="msg-body" style="font-style:italic;opacity:.6"></div>'
    document.getElementById('messages').appendChild(_interimEl)
  }
  _interimEl.querySelector('.msg-body').textContent = text + '…'
  document.getElementById('messages').scrollTop = 999999
}

function clearInterim() { if (_interimEl) { _interimEl.remove(); _interimEl = null } }

function setStatus(s) {
  document.getElementById('stat-status').textContent = s
  document.getElementById('stat-status').style.color = s === 'connected' ? 'var(--gold)' : 'var(--muted)'
}

function switchPersona(p) {
  location.href = '/warroom?persona=' + p
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function fmtNum(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'k'
  return String(n)
}
</script>
</body>
</html>`
}
