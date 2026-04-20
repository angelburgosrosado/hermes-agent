"""
War Room — HTML UI generator.
Produces the cinematic GoT-themed two-column command interface
with ClaudeClaw OS dashboard integration.
"""

from __future__ import annotations
import json


def build_html(personas: dict, active_mode: str = "production") -> str:
    personas_js = json.dumps({
        k: {"name": v["name"], "color": v.get("color", "#c9a84c")}
        for k, v in personas.items()
    })
    first_key = list(personas.keys())[0] if personas else "hand"
    mode_color = "#22c55e" if active_mode == "production" else "#ef4444"
    mode_bg    = "rgba(34,197,94,.12)" if active_mode == "production" else "rgba(239,68,68,.12)"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>War Room — ClaudeClaw OS</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --gold:    #c9a84c;
  --gold2:   #e8c96a;
  --crimson: #8b1a1a;
  --dark:    #08090f;
  --surface: #10121c;
  --surface2:#161824;
  --border:  #1e2035;
  --text:    #d8d0bc;
  --muted:   #5a5a72;
  --green:   #22c55e;
  --blue:    #6ab0f5;
  --accent:  #6c63ff;
  --font:    'Outfit', Georgia, serif;
}}
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ height: 100%; overflow: hidden; }}
body {{
  background: var(--dark); color: var(--text);
  font-family: var(--font); font-size: 13px;
  display: flex; flex-direction: column;
}}

/* ── Cinematic intro ────────────────────────────────── */
#intro {{
  position: fixed; inset: 0; background: #000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  z-index: 200; transition: opacity 1s ease;
}}
#intro.fade-out {{ opacity: 0; pointer-events: none; }}
.intro-sigil {{ font-size: 3.5rem; animation: spin-in .8s ease forwards; }}
.intro-title {{
  font-size: 2.6rem; font-weight: 600; color: var(--gold); letter-spacing: .25em;
  text-transform: uppercase; margin-top: 16px;
  animation: flicker 3s ease forwards;
}}
.intro-sub {{ color: var(--muted); font-size: .8rem; letter-spacing: .2em; margin-top: 8px; }}
@keyframes flicker {{
  0%{{opacity:0}}20%{{opacity:.4}}40%{{opacity:.9}}60%{{opacity:.5}}80%{{opacity:1}}100%{{opacity:1}}
}}
@keyframes spin-in {{
  from{{transform:rotate(-180deg) scale(0);opacity:0}}
  to{{transform:rotate(0) scale(1);opacity:1}}
}}

/* ── Header ─────────────────────────────────────────── */
header {{
  flex-shrink: 0;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}}
.logo {{ font-size: 1.1rem; font-weight: 700; color: var(--gold); letter-spacing: .15em; text-transform: uppercase; }}
.mode-badge {{
  padding: 2px 9px; border-radius: 20px; font-size: .65rem; font-weight: 600;
  letter-spacing: .08em; text-transform: uppercase;
  background: {mode_bg}; color: {mode_color}; border: 1px solid {mode_color}44;
}}
.pulse-dot {{
  width: 7px; height: 7px; border-radius: 50%;
  background: {mode_color}; animation: pulse-dot 2s infinite;
}}
@keyframes pulse-dot {{ 0%,100%{{opacity:1}}50%{{opacity:.3}} }}
header .spacer {{ flex: 1; }}
.btn {{
  background: var(--surface2); border: 1px solid var(--border); color: var(--muted);
  padding: 5px 13px; border-radius: 5px; cursor: pointer; font-family: var(--font);
  font-size: .75rem; font-weight: 500; transition: all .15s; white-space: nowrap;
}}
.btn:hover {{ border-color: var(--gold); color: var(--gold); }}
.btn-gold {{
  border-color: var(--gold)55; color: var(--gold);
  background: rgba(201,168,76,.08);
}}
.btn-gold:hover {{ background: rgba(201,168,76,.18); }}

/* ── Main two-column layout ─────────────────────────── */
.layout {{
  flex: 1; display: flex; overflow: hidden; min-height: 0;
}}

/* ── Left sidebar ───────────────────────────────────── */
.sidebar {{
  width: 300px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0;
  border-right: 1px solid var(--border);
  background: var(--surface); overflow-y: auto;
}}
.sidebar-section {{
  padding: 14px 16px; border-bottom: 1px solid var(--border);
}}
.section-label {{
  font-size: .65rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--muted); margin-bottom: 10px; font-weight: 600;
}}

/* ── Persona cards (spotlight border) ───────────────── */
.persona-grid {{
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}}
.p-card {{
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 7px; padding: 10px 12px; cursor: pointer;
  position: relative; overflow: hidden; transition: border-color .2s;
  user-select: none;
}}
.p-card::before {{
  content: ''; position: absolute; inset: -1px; border-radius: 7px;
  background: radial-gradient(circle 120px at var(--mx,50%) var(--my,50%),
    rgba(201,168,76,.18), transparent);
  opacity: 0; transition: opacity .25s; pointer-events: none;
}}
.p-card:hover::before {{ opacity: 1; }}
.p-card.active {{
  border-color: var(--gold); background: rgba(201,168,76,.07);
}}
.p-card .p-key {{ font-size: .62rem; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }}
.p-card .p-name {{ font-size: .85rem; font-weight: 600; color: var(--gold); margin-top: 2px; }}

/* ── Circular visualizer ────────────────────────────── */
.viz-wrap {{
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 16px 0 4px;
}}
#visualizer {{ width: 140px; height: 140px; }}
#mic-btn {{
  width: 60px; height: 60px; border-radius: 50%;
  background: var(--surface2); border: 2px solid var(--border);
  color: var(--text); font-size: 1.6rem; cursor: pointer;
  transition: all .2s; display: flex; align-items: center; justify-content: center;
}}
#mic-btn:hover {{ border-color: var(--gold); color: var(--gold); }}
#mic-btn.active {{
  border-color: var(--crimson); background: rgba(139,26,26,.25);
  color: #e06060; animation: mic-pulse 1.2s infinite;
}}
@keyframes mic-pulse {{
  0%,100%{{box-shadow:0 0 0 0 rgba(139,26,26,.5)}}
  50%{{box-shadow:0 0 0 10px rgba(139,26,26,0)}}
}}
#status {{
  font-size: .72rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--muted); font-weight: 500;
}}
#status.connected  {{ color: var(--green); }}
#status.speaking   {{ color: var(--gold); }}
#status.listening  {{ color: var(--blue); }}
#status.error      {{ color: var(--crimson); }}

/* ── Text input ─────────────────────────────────────── */
.text-row {{
  display: flex; gap: 6px; align-items: center;
}}
.text-row input {{
  flex: 1; background: var(--surface2); border: 1px solid var(--border);
  color: var(--text); padding: 7px 11px; border-radius: 5px;
  font-family: var(--font); font-size: .8rem;
  transition: border-color .15s; outline: none;
}}
.text-row input:focus {{ border-color: var(--gold)88; }}
.text-row input::placeholder {{ color: var(--muted); }}
.icon-btn {{
  width: 32px; height: 32px; border-radius: 5px; flex-shrink: 0;
  background: var(--surface2); border: 1px solid var(--border);
  color: var(--muted); cursor: pointer; font-size: .9rem;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}}
.icon-btn:hover {{ border-color: var(--gold); color: var(--gold); }}

/* ── Pin bar ─────────────────────────────────────────── */
.pin-row {{
  display: flex; align-items: center; gap: 6px; font-size: .72rem; color: var(--muted);
}}
.pin-row span {{ flex: 1; }}

/* ── Right main area ─────────────────────────────────── */
.main {{
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}}

/* ── OS status strip ─────────────────────────────────── */
.os-strip {{
  flex-shrink: 0; display: flex; gap: 0;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}}
.os-card {{
  flex: 1; padding: 10px 14px; border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 2px;
}}
.os-card:last-child {{ border-right: none; }}
.os-label {{ font-size: .6rem; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }}
.os-val {{ font-size: 1rem; font-weight: 700; color: var(--accent); }}
.os-sub  {{ font-size: .65rem; color: var(--muted); }}
.os-dot  {{
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  margin-right: 4px; vertical-align: middle;
}}

/* ── Agent list strip ─────────────────────────────────── */
.agent-strip {{
  flex-shrink: 0; display: flex; align-items: center; gap: 0;
  border-bottom: 1px solid var(--border); padding: 6px 14px;
  background: var(--surface); overflow-x: auto;
}}
.agent-chip {{
  display: flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px; font-size: .7rem; font-weight: 500;
  background: var(--surface2); border: 1px solid var(--border);
  color: var(--muted); white-space: nowrap; margin-right: 6px; flex-shrink: 0;
}}
.agent-chip.active-agent {{ border-color: var(--green)55; color: var(--green); }}
.agent-strip-label {{ font-size: .6rem; color: var(--muted); margin-right: 8px; text-transform: uppercase; letter-spacing: .1em; white-space: nowrap; }}

/* ── Transcript ──────────────────────────────────────── */
.transcript-wrap {{
  flex: 1; overflow-y: auto; padding: 14px 18px;
  display: flex; flex-direction: column; gap: 10px;
  scroll-behavior: smooth;
}}
.msg {{ display: flex; flex-direction: column; gap: 3px; }}
.msg-meta {{
  display: flex; align-items: baseline; gap: 7px;
  font-size: .67rem; text-transform: uppercase; letter-spacing: .08em;
}}
.msg-who {{ font-weight: 600; }}
.msg-ts  {{ color: var(--muted); font-size: .62rem; }}
.msg-body {{ font-size: .88rem; line-height: 1.65; padding-left: 2px; }}

.msg.user .msg-who  {{ color: var(--blue); }}
.msg.user .msg-body {{ color: #8ab8e8; }}
.msg.agent .msg-who  {{ color: var(--gold); }}
.msg.agent .msg-body {{ color: var(--text); }}
.msg.system .msg-who  {{ color: var(--muted); }}
.msg.system .msg-body {{ color: var(--muted); font-style: italic; }}

/* ── Mission launcher ────────────────────────────────── */
.mission-bar {{
  flex-shrink: 0; display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-top: 1px solid var(--border);
  background: var(--surface);
}}
.mission-bar .label {{ font-size: .65rem; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; white-space: nowrap; }}
.mission-bar input {{
  flex: 1; background: var(--surface2); border: 1px solid var(--border);
  color: var(--text); padding: 6px 11px; border-radius: 5px;
  font-family: var(--font); font-size: .8rem; outline: none;
  transition: border-color .15s;
}}
.mission-bar input:focus {{ border-color: var(--accent)88; }}
.mission-bar input::placeholder {{ color: var(--muted); }}
.mission-bar select {{
  background: var(--surface2); border: 1px solid var(--border);
  color: var(--text); padding: 6px 8px; border-radius: 5px;
  font-family: var(--font); font-size: .8rem; outline: none;
}}
.btn-accent {{
  background: rgba(108,99,255,.15); border: 1px solid rgba(108,99,255,.35);
  color: #a8a4ff; padding: 6px 14px; border-radius: 5px; cursor: pointer;
  font-family: var(--font); font-size: .78rem; font-weight: 600; white-space: nowrap;
  transition: all .15s;
}}
.btn-accent:hover {{ background: rgba(108,99,255,.3); color: #fff; }}
#mission-status {{ font-size: .72rem; color: var(--green); display: none; white-space: nowrap; }}

/* ── Warn banner ─────────────────────────────────────── */
#warn {{
  background: rgba(139,26,26,.15); border: 1px solid rgba(139,26,26,.4);
  border-radius: 6px; padding: 10px 14px; font-size: .8rem;
  color: #c08080; text-align: center; margin: 10px;
}}
#warn code {{ color: var(--gold); font-family: monospace; }}

/* ── Scrollbar ───────────────────────────────────────── */
::-webkit-scrollbar {{ width: 4px; height: 4px; }}
::-webkit-scrollbar-track {{ background: transparent; }}
::-webkit-scrollbar-thumb {{ background: var(--border); border-radius: 2px; }}
</style>
</head>
<body>

<!-- Cinematic intro -->
<div id="intro">
  <div class="intro-sigil">⚔</div>
  <div class="intro-title">War Room</div>
  <div class="intro-sub">ClaudeClaw OS — Voice Command Center</div>
</div>

<!-- Header -->
<header>
  <span class="logo">⚔ War Room</span>
  <span class="mode-badge">{active_mode.upper()}</span>
  <div class="pulse-dot"></div>
  <div class="spacer"></div>
  <div id="warn-inline" style="display:none;font-size:.72rem;color:#c08080;margin-right:8px">
    Missing voice keys — check <code style="color:var(--gold)">GEMINI_API_KEY</code>
  </div>
  <button class="btn btn-gold" onclick="window.open('http://localhost:3141','_blank')">OS Dashboard ↗</button>
</header>

<!-- Two-column layout -->
<div class="layout">

  <!-- LEFT: Controls sidebar -->
  <div class="sidebar">

    <!-- Persona selector -->
    <div class="sidebar-section">
      <div class="section-label">Council</div>
      <div class="persona-grid" id="persona-grid"></div>
    </div>

    <!-- Visualizer + mic -->
    <div class="sidebar-section">
      <div class="viz-wrap">
        <canvas id="visualizer" width="140" height="140"></canvas>
        <button id="mic-btn" onclick="toggleMic()" title="Toggle microphone">🎙</button>
        <div id="status">STANDBY</div>
      </div>
    </div>

    <!-- Text input -->
    <div class="sidebar-section">
      <div class="section-label">Text Mode</div>
      <div class="text-row">
        <input id="text-input" type="text" placeholder="Type a message…" onkeydown="if(event.key==='Enter')sendText()">
        <button class="icon-btn" onclick="sendText()" title="Send">→</button>
      </div>
    </div>

    <!-- Pin control -->
    <div class="sidebar-section">
      <div class="section-label">Agent Pin</div>
      <div class="pin-row">
        <span id="pin-status">No agent pinned</span>
        <button class="btn" onclick="unpinAgent()">Unpin</button>
      </div>
    </div>

  </div><!-- /sidebar -->

  <!-- RIGHT: Main content -->
  <div class="main">

    <!-- OS Status strip -->
    <div class="os-strip" id="os-strip">
      <div class="os-card">
        <div class="os-label">Tokens Today</div>
        <div class="os-val" id="os-tokens">—</div>
        <div class="os-sub" id="os-tokens-sub">loading…</div>
      </div>
      <div class="os-card">
        <div class="os-label">Cost Today</div>
        <div class="os-val" id="os-cost">—</div>
        <div class="os-sub" id="os-cost-sub">USD</div>
      </div>
      <div class="os-card">
        <div class="os-label">Sessions</div>
        <div class="os-val" id="os-sessions">—</div>
        <div class="os-sub">active chats</div>
      </div>
      <div class="os-card">
        <div class="os-label">OS Status</div>
        <div class="os-val" id="os-uptime" style="font-size:.85rem">—</div>
        <div class="os-sub" id="os-status-sub">—</div>
      </div>
    </div>

    <!-- Agent status chips -->
    <div class="agent-strip" id="agent-strip">
      <span class="agent-strip-label">Agents</span>
      <span id="agent-chips" style="display:flex;gap:0"></span>
    </div>

    <!-- Transcript -->
    <div id="warn" style="display:none">
      Missing voice keys. Add <code>DEEPGRAM_API_KEY</code> + <code>CARTESIA_API_KEY</code> or <code>GEMINI_API_KEY</code> to <code>.env</code>.
    </div>
    <div class="transcript-wrap" id="transcript"></div>

    <!-- Mission launcher -->
    <div class="mission-bar">
      <span class="label">Mission</span>
      <input id="mission-input" type="text" placeholder="Describe the mission…" onkeydown="if(event.key==='Enter')launchMission()">
      <select id="mission-agent">
        <option value="orchestrator">orchestrator</option>
        <option value="research">research</option>
        <option value="content">content</option>
        <option value="comms">comms</option>
        <option value="ops">ops</option>
      </select>
      <button class="btn-accent" onclick="launchMission()">🚀 Launch</button>
      <span id="mission-status">Launched ✓</span>
    </div>

  </div><!-- /main -->
</div><!-- /layout -->

<script>
const PERSONAS = {personas_js};
let activePersona = '{first_key}';
let ws = null;
let mediaRecorder = null;
let audioCtx = null;
let analyser = null;
let vizFrame = null;
let silenceTimer = null;
const SILENCE_TIMEOUT_MS = 60000;
const SILENCE_THRESHOLD  = 8;

// ── Intro fade ──────────────────────────────────────────────────────────────
setTimeout(() => {{
  const el = document.getElementById('intro');
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 1000);
}}, 2000);

// ── Persona cards (spotlight border) ───────────────────────────────────────
const grid = document.getElementById('persona-grid');
Object.entries(PERSONAS).forEach(([key, p]) => {{
  const d = document.createElement('div');
  d.className = 'p-card' + (key === activePersona ? ' active' : '');
  d.id = 'card-' + key;
  d.innerHTML = `<div class="p-key">${{key}}</div><div class="p-name">${{p.name}}</div>`;
  d.onclick = () => selectPersona(key);
  d.addEventListener('mousemove', (e) => {{
    const r = d.getBoundingClientRect();
    d.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    d.style.setProperty('--my', (e.clientY - r.top)  + 'px');
  }});
  grid.appendChild(d);
}});

function selectPersona(key) {{
  document.querySelectorAll('.p-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + key)?.classList.add('active');
  activePersona = key;
  if (ws?.readyState === 1) ws.send(JSON.stringify({{ type: 'set_persona', persona: key }}));
}}

// ── Status ──────────────────────────────────────────────────────────────────
function setStatus(msg, cls) {{
  const el = document.getElementById('status');
  el.textContent = msg; el.className = cls || '';
}}

// ── Transcript ──────────────────────────────────────────────────────────────
function addMsg(role, who, text) {{
  const wrap = document.getElementById('transcript');
  const ts   = new Date().toLocaleTimeString([], {{hour:'2-digit',minute:'2-digit'}});
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.innerHTML = `
    <div class="msg-meta">
      <span class="msg-who">${{escHtml(who)}}</span>
      <span class="msg-ts">${{ts}}</span>
    </div>
    <div class="msg-body">${{escHtml(text)}}</div>`;
  wrap.appendChild(d);
  wrap.scrollTop = wrap.scrollHeight;
}}

function escHtml(s) {{
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}}

// ── Pin ─────────────────────────────────────────────────────────────────────
function unpinAgent() {{
  fetch('/api/unpin', {{method:'POST'}})
    .then(() => document.getElementById('pin-status').textContent = 'No agent pinned');
}}

// ── Circular visualizer ─────────────────────────────────────────────────────
function startVisualizer(stream) {{
  if (!audioCtx) audioCtx = new AudioContext({{sampleRate:16000}});
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  src.connect(analyser);
  drawViz();
}}

function stopVisualizer() {{
  if (vizFrame) {{ cancelAnimationFrame(vizFrame); vizFrame = null; }}
  const cv = document.getElementById('visualizer');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}}

function drawViz() {{
  const cv = document.getElementById('visualizer');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, CX = W/2, CY = H/2;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  ctx.clearRect(0, 0, W, H);

  // Outer ring track
  ctx.beginPath();
  ctx.arc(CX, CY, 52, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201,168,76,.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Radial bars
  const N = data.length;
  for (let i = 0; i < N; i++) {{
    const angle  = (i / N) * Math.PI * 2 - Math.PI / 2;
    const norm   = data[i] / 255;
    const inner  = 28;
    const barLen = 6 + norm * 28;
    const alpha  = 0.25 + norm * 0.75;
    const x1 = CX + Math.cos(angle) * inner;
    const y1 = CY + Math.sin(angle) * inner;
    const x2 = CX + Math.cos(angle) * (inner + barLen);
    const y2 = CY + Math.sin(angle) * (inner + barLen);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(201,168,76,${{alpha}})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }}

  // Center dot
  const avgNorm = data.reduce((a,v) => a+v, 0) / (N * 255);
  const dotR = 5 + avgNorm * 8;
  ctx.beginPath();
  ctx.arc(CX, CY, dotR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(201,168,76,${{0.3 + avgNorm * 0.7}})`;
  ctx.fill();

  // Silence detection
  const avg = data.reduce((a,v) => a+v, 0) / N;
  if (avg > SILENCE_THRESHOLD) resetSilenceTimer();

  vizFrame = requestAnimationFrame(drawViz);
}}

// ── Silence timer ───────────────────────────────────────────────────────────
function resetSilenceTimer() {{
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {{
    addMsg('system', 'System', 'Auto-disconnected after 60 s of silence.');
    stopSession();
  }}, SILENCE_TIMEOUT_MS);
}}

function stopSilenceTimer() {{
  clearTimeout(silenceTimer); silenceTimer = null;
}}

// ── WebSocket session ───────────────────────────────────────────────────────
async function toggleMic() {{
  if (ws?.readyState === 1) {{ stopSession(); return; }}
  await startSession();
}}

async function startSession() {{
  setStatus('CONNECTING…', '');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${{proto}}://${{location.host}}/ws/voice?persona=${{activePersona}}`);
  ws.binaryType = 'arraybuffer';

  ws.onopen = async () => {{
    setStatus('LISTENING', 'listening');
    document.getElementById('mic-btn').classList.add('active');
    await startMic();
  }};

  ws.onmessage = async (e) => {{
    if (typeof e.data === 'string') {{
      const msg = JSON.parse(e.data);
      if (msg.type === 'transcript_user' && msg.final) addMsg('user', 'You', msg.text);
      if (msg.type === 'transcript_agent') {{
        addMsg('agent', msg.persona || 'Agent', msg.text);
        setStatus('SPEAKING…', 'speaking');
      }}
      if (msg.type === 'error') setStatus('ERROR: ' + msg.text, 'error');
    }} else {{
      setStatus('SPEAKING…', 'speaking');
      await playPcm(e.data);
    }}
  }};

  ws.onerror = () => setStatus('CONNECTION ERROR', 'error');
  ws.onclose = () => {{
    setStatus('STANDBY', '');
    document.getElementById('mic-btn').classList.remove('active');
    stopMic();
  }};
}}

async function playPcm(buf) {{
  const SR = 16000;
  if (!audioCtx) audioCtx = new AudioContext({{sampleRate:SR}});
  try {{
    const i16 = new Int16Array(buf);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
    const ab = audioCtx.createBuffer(1, f32.length, SR);
    ab.copyToChannel(f32, 0);
    const src = audioCtx.createBufferSource();
    src.buffer = ab;
    src.connect(audioCtx.destination);
    src.onended = () => setStatus('LISTENING', 'listening');
    src.start();
  }} catch {{ setStatus('LISTENING', 'listening'); }}
}}

async function startMic() {{
  const stream = await navigator.mediaDevices.getUserMedia({{
    audio: {{sampleRate:16000, channelCount:1, echoCancellation:true, noiseSuppression:true}}
  }});
  if (!audioCtx) audioCtx = new AudioContext({{sampleRate:16000}});
  startVisualizer(stream);
  const source    = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(512, 1, 1);
  processor.onaudioprocess = (e) => {{
    if (ws?.readyState !== 1) return;
    const f32 = e.inputBuffer.getChannelData(0);
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++)
      i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
    ws.send(i16.buffer);
  }};
  source.connect(processor);
  processor.connect(audioCtx.destination);
  mediaRecorder = {{processor, source, stream}};
  resetSilenceTimer();
}}

function stopMic() {{
  stopVisualizer(); stopSilenceTimer();
  if (mediaRecorder) {{
    mediaRecorder.processor?.disconnect();
    mediaRecorder.source?.disconnect();
    mediaRecorder.stream?.getTracks().forEach(t => t.stop());
    mediaRecorder = null;
  }}
}}

function stopSession() {{
  ws?.close(); ws = null; stopMic();
  setStatus('STANDBY', '');
  document.getElementById('mic-btn').classList.remove('active');
}}

// ── Text mode ───────────────────────────────────────────────────────────────
async function sendText() {{
  const inp = document.getElementById('text-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  addMsg('user', 'You', text);
  try {{
    const r = await fetch('/api/text', {{
      method: 'POST',
      headers: {{'Content-Type':'application/json'}},
      body: JSON.stringify({{text, persona: activePersona}}),
    }});
    const d = await r.json();
    if (d.reply) addMsg('agent', d.persona || 'Agent', d.reply);
    else addMsg('system', 'Error', d.error || 'No reply');
  }} catch (err) {{
    addMsg('system', 'Error', String(err));
  }}
}}

// ── Mission launcher ─────────────────────────────────────────────────────────
async function launchMission() {{
  const prompt = document.getElementById('mission-input').value.trim();
  if (!prompt) return;
  const agent = document.getElementById('mission-agent').value;
  try {{
    const r = await fetch('http://localhost:3141/api/missions', {{
      method: 'POST',
      headers: {{'Content-Type':'application/json'}},
      body: JSON.stringify({{title: prompt.slice(0, 60), prompt, agentId: agent, priority: 'medium'}}),
    }});
    if (r.ok) {{
      document.getElementById('mission-input').value = '';
      const st = document.getElementById('mission-status');
      st.style.display = 'inline';
      setTimeout(() => st.style.display = 'none', 3000);
      addMsg('system', 'Mission', `Launched → ${{agent}}: ${{prompt.slice(0,80)}}`);
    }}
  }} catch (err) {{
    addMsg('system', 'Error', 'Could not reach OS dashboard: ' + err.message);
  }}
}}

// ── OS Status ────────────────────────────────────────────────────────────────
function fmt(n) {{
  if (n == null) return '—';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1)+'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1)+'K';
  return String(n);
}}

async function refreshOsStatus() {{
  try {{
    const r = await fetch('/api/os-status');
    const d = await r.json();
    if (!d.ok) return;

    const s = d.stats;
    document.getElementById('os-tokens').textContent     = fmt(s.dailyTokens);
    document.getElementById('os-tokens-sub').textContent = `${{fmt(s.hourlyTokens)}} this hour`;
    document.getElementById('os-cost').textContent       = s.dailyCost != null ? '$'+s.dailyCost.toFixed(3) : '—';
    document.getElementById('os-sessions').textContent   = fmt(s.activeSessions ?? s.sessions);
    document.getElementById('os-uptime').textContent     = 'ONLINE';
    document.getElementById('os-uptime').style.color     = 'var(--green)';
    document.getElementById('os-status-sub').textContent = 'dashboard reachable';

    // Agent chips
    const chips = document.getElementById('agent-chips');
    chips.innerHTML = '';
    const agents = Array.isArray(d.agents) ? d.agents : Object.entries(d.agents).map(([id,a]) => ({{id, ...a}}));
    agents.forEach(a => {{
      const chip = document.createElement('span');
      const isActive = a.active || a.status === 'active';
      chip.className = 'agent-chip' + (isActive ? ' active-agent' : '');
      const dot = `<span class="os-dot" style="background:${{isActive ? 'var(--green)' : 'var(--muted)'}}"></span>`;
      chip.innerHTML = dot + escHtml(a.name || a.id || '?');
      chips.appendChild(chip);
    }});
  }} catch {{
    document.getElementById('os-uptime').textContent   = 'OFFLINE';
    document.getElementById('os-uptime').style.color   = 'var(--muted)';
    document.getElementById('os-status-sub').textContent = 'dashboard unreachable';
  }}
}}

// ── Health check + init ──────────────────────────────────────────────────────
fetch('/health').then(r => r.json()).then(d => {{
  const keysOk = d.gemini_live || (d.deepgram && d.cartesia);
  if (!keysOk) {{
    document.getElementById('warn').style.display = 'block';
    document.getElementById('warn-inline').style.display = 'inline';
  }}
}});

refreshOsStatus();
setInterval(refreshOsStatus, 30_000);
</script>
</body>
</html>"""
