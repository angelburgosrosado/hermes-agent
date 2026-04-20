export function getDashboardHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClaudeClaw OS — Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
  :root {
    --bg: #0a0c14; --surface: #13161f; --border: #1e2235;
    --accent: #6c63ff; --accent2: #00d4aa; --text: #e8eaf0; --muted: #6b7280;
    --warn: #f59e0b; --err: #ef4444; --ok: #22c55e;
    --font: 'SF Mono', 'Fira Code', monospace;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px; height: 100vh; display: flex; flex-direction: column }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px }
  .logo { color: var(--accent); font-weight: bold; font-size: 15px; letter-spacing: 1px }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); animation: pulse 2s infinite }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
  .header-right { margin-left: auto; display: flex; gap: 12px; align-items: center }
  .btn { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: var(--font); font-size: 12px }
  .btn:hover { border-color: var(--accent); color: var(--accent) }
  .main { flex: 1; display: grid; grid-template-columns: 280px 1fr; overflow: hidden }
  .sidebar { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 16px }
  .content { overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px }
  .card-title { color: var(--muted); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px }
  .stat-val { font-size: 28px; font-weight: bold; color: var(--accent) }
  .stat-label { color: var(--muted); font-size: 11px; margin-top: 2px }
  .chart-wrap { position: relative; height: 160px }
  .log-area { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; height: 220px; overflow-y: auto; font-size: 11px; line-height: 1.6 }
  .log-line { display: flex; gap: 8px }
  .log-ts { color: var(--muted); flex-shrink: 0 }
  .log-level-info { color: var(--accent2) }
  .log-level-warn { color: var(--warn) }
  .log-level-error { color: var(--err) }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 10px; font-weight: bold }
  .badge-ok { background: rgba(34,197,94,.15); color: var(--ok) }
  .badge-warn { background: rgba(245,158,11,.15); color: var(--warn) }
  .badge-err { background: rgba(239,68,68,.15); color: var(--err) }
  .badge-muted { background: rgba(107,114,128,.15); color: var(--muted) }
  .agent-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border) }
  .agent-row:last-child { border-bottom: none }
  .agent-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0 }
  .agent-dot-active { background: var(--ok) }
  .agent-dot-idle { background: var(--muted) }
  .agent-name { flex: 1 }
  .task-table { width: 100%; border-collapse: collapse }
  .task-table th { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 8px; border-bottom: 1px solid var(--border); text-align: left }
  .task-table td { padding: 6px 8px; border-bottom: 1px solid rgba(30,34,53,.6); font-size: 12px }
  .sidebar-section { margin-bottom: 20px }
  .sidebar-title { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px }
  .nav-item { padding: 6px 8px; border-radius: 4px; cursor: pointer; color: var(--muted); display: flex; align-items: center; gap: 8px }
  .nav-item:hover,.nav-item.active { background: rgba(108,99,255,.1); color: var(--accent) }
  .input-row { display: flex; gap: 8px; margin-top: 8px }
  .input-row input { flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 6px 10px; border-radius: 4px; font-family: var(--font); font-size: 12px }
  .input-row input:focus { outline: none; border-color: var(--accent) }
  #chat-messages { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; height: 160px; overflow-y: auto; padding: 8px; font-size: 12px; line-height: 1.7; margin-bottom: 4px }
  .msg-user { color: var(--accent) }
  .msg-bot { color: var(--text) }
  .msg-ts { color: var(--muted); font-size: 10px; margin-right: 6px }
  /* Section guide panel */
  #section-guide {
    background: var(--surface); border-top: 1px solid var(--border);
    padding: 10px 24px; display: flex; gap: 24px; align-items: flex-start;
    min-height: 80px; max-height: 130px; overflow: hidden;
    transition: max-height .25s ease, padding .25s ease;
    position: relative;
  }
  #section-guide.collapsed { max-height: 32px; padding-top: 6px; padding-bottom: 6px; overflow: hidden }
  #guide-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px }
  #guide-body { flex: 1; min-width: 0 }
  #guide-title { color: var(--accent); font-size: 12px; font-weight: bold; letter-spacing: .5px; margin-bottom: 4px }
  #guide-desc { color: var(--muted); font-size: 11px; line-height: 1.5; margin-bottom: 6px }
  #guide-actions { display: flex; flex-wrap: wrap; gap: 6px }
  .guide-chip {
    background: rgba(108,99,255,.08); border: 1px solid rgba(108,99,255,.2);
    color: var(--accent2); font-size: 10px; padding: 2px 8px; border-radius: 20px;
    white-space: nowrap;
  }
  #guide-toggle {
    position: absolute; top: 8px; right: 12px;
    background: none; border: 1px solid var(--border); color: var(--muted);
    border-radius: 4px; padding: 1px 7px; cursor: pointer; font-size: 10px;
    font-family: var(--font);
  }
  #guide-toggle:hover { border-color: var(--accent); color: var(--accent) }
  /* QR modal */
  #qr-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,.75); z-index:1000; align-items:center; justify-content:center }
  #qr-modal.open { display:flex }
  #qr-box { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:28px 32px; text-align:center; min-width:280px }
  #qr-box h3 { color:var(--text); margin-bottom:6px; font-size:14px }
  #qr-box p { color:var(--muted); font-size:11px; margin-bottom:16px }
  #qr-canvas { display:flex; justify-content:center; margin-bottom:16px }
  #qr-status { font-size:11px; color:var(--muted); margin-bottom:12px }
  /* Usage section */
  .ubtn-range { padding:3px 12px; background:transparent; border:none; border-right:1px solid var(--border); color:var(--muted); font-size:11px; cursor:pointer; font-family:var(--font); transition:background .15s,color .15s }
  .ubtn-range:last-child { border-right:none }
  .ubtn-range:hover { background:rgba(255,255,255,.04); color:var(--text) }
  .ubtn-range.active { background:rgba(108,99,255,.15); color:var(--accent); font-weight:600 }
  .u-model-chip { display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:20px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--muted);font-family:var(--font);transition:border-color .15s,color .15s,background .15s;user-select:none }
  .u-model-chip:hover { border-color:var(--accent);color:var(--text) }
  .u-model-chip.checked { background:rgba(108,99,255,.12);border-color:var(--accent);color:var(--text) }
  .u-stat-cell { background:var(--surface);padding:14px 18px;border-right:1px solid var(--border) }
  .u-stat-cell:last-child { border-right:none }
  .u-sort { cursor:pointer;user-select:none;white-space:nowrap }
  .u-sort:hover { color:var(--text) }
  .ucost { color:var(--ok);font-family:monospace }
  .ucost-na { color:var(--muted);font-family:monospace;font-size:11px }
</style>
</head>
<body>
<header>
  <div class="logo">⚡ CLAUDECLAW OS</div>
  <div class="status-dot" id="conn-dot"></div>
  <span id="conn-status" style="color:var(--muted);font-size:11px">connecting…</span>
  <div class="header-right">
    <span id="uptime-badge" class="badge badge-muted">uptime —</span>
    <button class="btn" onclick="sendCmd('/status')">Status</button>
    <button class="btn" onclick="sendCmd('/health')">Health</button>
  </div>
</header>
<div class="main">
  <div class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-title">Navigation</div>
      <div class="nav-item active" onclick="showSection('overview',this)">📊 Overview</div>
      <div class="nav-item" onclick="showSection('agents',this)">🤖 Agents</div>
      <div class="nav-item" onclick="showSection('skills',this)">🛠 Skills</div>
      <div class="nav-item" onclick="showSection('tasks',this)">📋 Tasks</div>
      <div class="nav-item" onclick="showSection('memory',this)">🧠 Memory</div>
      <div class="nav-item" onclick="showSection('console',this)">💬 Console</div>
      <div class="nav-item" onclick="showSection('history',this)">📜 History</div>
      <div class="nav-item" onclick="showSection('services',this)">🔌 Services</div>
      <div class="nav-item" onclick="showSection('usage',this)">💰 Usage & Cost</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-title">Quick Stats</div>
      <div id="sidebar-stats" style="color:var(--muted);font-size:11px;line-height:2"></div>
    </div>
  </div>
  <div class="content">

    <!-- OVERVIEW -->
    <div id="sec-overview">
      <div class="grid-3">
        <div class="card"><div class="card-title">Daily Tokens</div><div class="stat-val" id="stat-tokens">—</div><div class="stat-label">used today</div></div>
        <div class="card"><div class="card-title">Daily Cost</div><div class="stat-val" id="stat-cost">—</div><div class="stat-label">USD today</div></div>
        <div class="card"><div class="card-title">Sessions</div><div class="stat-val" id="stat-sessions">—</div><div class="stat-label">active chats</div></div>
      </div>
      <div class="grid-2" style="margin-top:16px">
        <div class="card"><div class="card-title">Token Usage (24h)</div><div class="chart-wrap"><canvas id="chart-tokens"></canvas></div></div>
        <div class="card"><div class="card-title">Cost (24h)</div><div class="chart-wrap"><canvas id="chart-cost"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Live Log</div>
        <div class="log-area" id="log-area"></div>
      </div>
    </div>

    <!-- AGENTS -->
    <div id="sec-agents" style="display:none">
      <div class="card"><div class="card-title">Registered Agents</div><div id="agents-list"></div></div>
    </div>

    <!-- SKILLS -->
    <div id="sec-skills" style="display:none">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">
          Registered Skills
          <button class="btn" style="font-size:10px;padding:2px 8px" onclick="reloadSkills()">Reload</button>
          <span id="skill-count" style="color:var(--muted);font-size:11px"></span>
        </div>
        <div id="skills-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-top:8px"></div>
      </div>
    </div>

    <!-- TASKS -->
    <div id="sec-tasks" style="display:none">
      <div class="grid-2">
        <!-- Create Mission -->
        <div class="card">
          <div class="card-title">New Mission</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input id="new-mission-title" placeholder="Title (e.g. Draft Q2 report)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:var(--font);font-size:12px">
            <textarea id="new-mission-prompt" placeholder="Prompt — describe the task in full" rows="3" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:var(--font);font-size:12px;resize:vertical"></textarea>
            <div style="display:flex;gap:6px">
              <select id="new-mission-agent" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:var(--font);font-size:12px">
                <option value="orchestrator">orchestrator</option>
                <option value="research">research</option>
                <option value="content">content</option>
                <option value="comms">comms</option>
                <option value="ops">ops</option>
              </select>
              <select id="new-mission-priority" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:var(--font);font-size:12px">
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
                <option value="low">low</option>
              </select>
            </div>
            <button class="btn" onclick="createMission()" style="align-self:flex-end">Add Mission</button>
            <div id="mission-create-msg" style="font-size:11px;color:var(--ok);display:none">Mission created.</div>
          </div>
        </div>
        <!-- Schedule Task -->
        <div class="card">
          <div class="card-title">New Scheduled Task</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input id="new-task-name" placeholder="Label (optional)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:var(--font);font-size:12px">
            <textarea id="new-task-prompt" placeholder="Prompt — what the agent should do" rows="3" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:var(--font);font-size:12px;resize:vertical"></textarea>
            <input id="new-task-cron" placeholder="Cron expression — e.g. 0 9 * * 1-5" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:4px;font-family:var(--font);font-size:12px">
            <select id="new-task-agent" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:var(--font);font-size:12px">
              <option value="orchestrator">orchestrator</option>
              <option value="research">research</option>
              <option value="content">content</option>
              <option value="comms">comms</option>
              <option value="ops">ops</option>
            </select>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="btn" onclick="createTask()" style="align-self:flex-end">Schedule</button>
              <span style="color:var(--muted);font-size:10px">common: <code style="color:var(--accent2)">0 9 * * *</code> daily 9am · <code style="color:var(--accent2)">0 9 * * 1</code> weekly Mon</span>
            </div>
            <div id="task-create-msg" style="font-size:11px;color:var(--ok);display:none">Task scheduled.</div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Mission Queue</div>
        <table class="task-table" id="mission-table">
          <thead><tr><th>Title</th><th>Agent</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
          <tbody id="mission-tbody"></tbody>
        </table>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Scheduled Tasks</div>
        <table class="task-table" id="task-table">
          <thead><tr><th>Name</th><th>Cron</th><th>Agent</th><th>Next Run</th><th>Status</th></tr></thead>
          <tbody id="task-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- HISTORY -->
    <div id="sec-history" style="display:none">
      <div class="grid-2" style="height:calc(100vh - 120px)">
        <div class="card" style="overflow-y:auto">
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            Conversations
            <input id="history-search" placeholder="filter…" oninput="filterHistoryChats()" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:4px;font-family:var(--font);font-size:11px">
          </div>
          <div id="history-chat-list" style="margin-top:4px"></div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;overflow:hidden">
          <div class="card-title" id="history-chat-title">Select a conversation</div>
          <div id="history-messages" style="flex:1;overflow-y:auto;font-size:12px;line-height:1.7"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn" id="history-load-more" onclick="loadMoreHistory()" style="display:none;font-size:10px">Load older</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MEMORY -->
    <div id="sec-memory" style="display:none">
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Memory Stats</div>
          <div id="memory-stats" style="color:var(--muted);line-height:2.2;font-size:12px"></div>
        </div>
        <div class="card">
          <div class="card-title">Recent Consolidations</div>
          <div id="consolidation-info" style="font-size:12px"></div>
        </div>
      </div>
      <!-- Add Memory form -->
      <div class="card" style="margin-top:16px">
        <div class="card-title">Add Memory</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <textarea id="new-memory-text" rows="2" placeholder="Enter a fact to remember — e.g. &quot;Angel prefers concise bullet-point responses over paragraphs&quot;" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:4px;font-family:var(--font);font-size:12px;resize:vertical"></textarea>
          <div style="display:flex;align-items:center;gap:8px">
            <select id="new-memory-chat" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:4px;font-family:var(--font);font-size:12px">
              <option value="global">global (all chats)</option>
              <option value="dashboard">dashboard</option>
            </select>
            <button class="btn" onclick="addMemory()">📌 Save &amp; Pin</button>
            <span id="memory-save-status" style="font-size:11px;display:none"></span>
          </div>
          <div style="color:var(--muted);font-size:10px">Saved memories are pinned at importance 1.0 and injected into every agent response for that chat.</div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">
          Top Memories by Importance
          <button class="btn" style="font-size:10px;padding:2px 8px;margin-left:auto" onclick="fetch('/api/memory?token='+TOKEN).then(r=>r.json()).then(renderMemory)">Refresh</button>
        </div>
        <table class="task-table" id="memory-table">
          <thead><tr><th>Chat</th><th>Summary</th><th>Importance</th><th>Pinned</th><th>Created</th></tr></thead>
          <tbody id="memory-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- CONSOLE -->
    <div id="sec-console" style="display:none">
      <div class="card">
        <div class="card-title">Interactive Console</div>
        <div id="chat-messages"></div>
        <div class="input-row">
          <input id="chat-input" placeholder="Send message or /command…" onkeydown="if(event.key==='Enter')sendChat()">
          <button class="btn" onclick="sendChat()">Send</button>
        </div>
      </div>
    </div>

    <!-- SERVICES -->
    <div id="sec-services" style="display:none">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">
          Service Health
          <button class="btn" style="font-size:10px;padding:2px 8px" onclick="refreshHealth()">Refresh</button>
          <span id="health-checked-at" style="color:var(--muted);font-size:10px;margin-left:auto"></span>
        </div>
        <div id="service-health" style="margin-top:8px"></div>
      </div>
    </div>

    <!-- USAGE & COST -->
    <div id="sec-usage" style="display:none">
      <!-- Filter bar -->
      <div class="card" style="padding:10px 16px;margin-bottom:0;border-bottom:none;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px">Range</span>
        <div style="display:flex;border:1px solid var(--border);border-radius:5px;overflow:hidden">
          <button id="ubtn-7d"  class="ubtn-range active" onclick="uSetRange('7d')">7d</button>
          <button id="ubtn-30d" class="ubtn-range" onclick="uSetRange('30d')">30d</button>
          <button id="ubtn-90d" class="ubtn-range" onclick="uSetRange('90d')">90d</button>
          <button id="ubtn-all" class="ubtn-range" onclick="uSetRange('all')">All</button>
        </div>
        <div id="u-model-filters" style="display:flex;gap:6px;flex-wrap:wrap"></div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
          <span id="u-scan-msg" style="color:var(--muted);font-size:11px"></span>
          <button class="btn" style="font-size:10px;padding:2px 10px" onclick="uTriggerScan()">⟳ Scan</button>
        </div>
      </div>
      <!-- Stats strip -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0;border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;overflow:hidden;margin-bottom:16px" id="u-stats-strip">
        <div class="u-stat-cell"><div class="stat-label">Today's Cost</div><div class="stat-val" id="u-today-cost">—</div></div>
        <div class="u-stat-cell"><div class="stat-label">All-Time Cost</div><div class="stat-val" id="u-total-cost">—</div></div>
        <div class="u-stat-cell"><div class="stat-label">Today's Tokens</div><div class="stat-val" id="u-today-tokens">—</div></div>
        <div class="u-stat-cell"><div class="stat-label">Total Sessions</div><div class="stat-val" id="u-total-sessions">—</div></div>
        <div class="u-stat-cell"><div class="stat-label">Total Turns</div><div class="stat-val" id="u-total-turns">—</div></div>
      </div>
      <!-- Charts -->
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card" style="grid-column:1/-1">
          <div class="card-title" id="u-daily-title">Daily Token Usage</div>
          <div style="position:relative;height:220px"><canvas id="u-chart-daily"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">By Model</div>
          <div style="position:relative;height:200px"><canvas id="u-chart-model"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Top Projects</div>
          <div style="position:relative;height:200px"><canvas id="u-chart-project"></canvas></div>
        </div>
      </div>
      <!-- Cost by Model table -->
      <div class="card" style="margin-bottom:16px;overflow-x:auto">
        <div class="card-title">Cost by Model</div>
        <table class="task-table">
          <thead><tr>
            <th>Model</th>
            <th class="u-sort" onclick="uSetModelSort('turns')">Turns <span id="ums-turns"></span></th>
            <th class="u-sort" onclick="uSetModelSort('input')">Input <span id="ums-input"></span></th>
            <th class="u-sort" onclick="uSetModelSort('output')">Output <span id="ums-output"></span></th>
            <th class="u-sort" onclick="uSetModelSort('cache_read')">Cache Read <span id="ums-cache_read"></span></th>
            <th class="u-sort" onclick="uSetModelSort('cache_creation')">Cache Write <span id="ums-cache_creation"></span></th>
            <th class="u-sort" onclick="uSetModelSort('cost')">Est. Cost <span id="ums-cost">▼</span></th>
          </tr></thead>
          <tbody id="u-model-body"></tbody>
        </table>
      </div>
      <!-- Sessions table -->
      <div class="card" style="overflow-x:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="card-title" style="margin-bottom:0">Recent Sessions</div>
          <button class="btn" style="font-size:10px;padding:2px 8px" onclick="uExportCSV()">↓ CSV</button>
        </div>
        <table class="task-table">
          <thead><tr>
            <th>Session</th>
            <th>Project</th>
            <th class="u-sort" onclick="uSetSessSort('last')">Last Active <span id="uss-last">▼</span></th>
            <th class="u-sort" onclick="uSetSessSort('duration_min')">Duration <span id="uss-duration_min"></span></th>
            <th>Model</th>
            <th class="u-sort" onclick="uSetSessSort('turns')">Turns <span id="uss-turns"></span></th>
            <th class="u-sort" onclick="uSetSessSort('input')">Input <span id="uss-input"></span></th>
            <th class="u-sort" onclick="uSetSessSort('output')">Output <span id="uss-output"></span></th>
            <th class="u-sort" onclick="uSetSessSort('cost')">Est. Cost <span id="uss-cost"></span></th>
          </tr></thead>
          <tbody id="u-sess-body"></tbody>
        </table>
      </div>
      <div style="color:var(--muted);font-size:10px;margin-top:8px;text-align:right">
        Pricing: Anthropic API April 2026. Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per M tokens (input/output).
      </div>
    </div>

  </div>
</div>

<!-- Section guide -->
<div id="section-guide">
  <div id="guide-icon">📊</div>
  <div id="guide-body">
    <div id="guide-title">OVERVIEW</div>
    <div id="guide-desc">Real-time system dashboard showing token usage, cost, active sessions, and a live activity log.</div>
    <div id="guide-actions"></div>
  </div>
  <button id="guide-toggle" onclick="toggleGuide()">▼ hide</button>
</div>

<!-- WhatsApp QR modal -->
<div id="qr-modal" onclick="closeQrModal(event)">
  <div id="qr-box">
    <h3>📱 Link WhatsApp</h3>
    <p>Open WhatsApp → Linked Devices → Link a Device</p>
    <div id="qr-canvas"></div>
    <div id="qr-status">Loading QR code…</div>
    <button class="btn" onclick="document.getElementById('qr-modal').classList.remove('open')">Close</button>
  </div>
</div>

<script>
const TOKEN = '${token}'
let es = null
let _reconnectTimer = null
let tokenChart = null, costChart = null
let startTime = Date.now()

// ── SSE connection ──────────────────────────────────────────────────────────
function connect() {
  if (es && es.readyState !== EventSource.CLOSED) return // already open or connecting
  if (es) { es.close(); es = null }
  es = new EventSource('/api/stream?token=' + TOKEN)
  es.onopen = () => {
    document.getElementById('conn-status').textContent = 'connected'
    document.getElementById('conn-dot').style.background = 'var(--ok)'
  }
  es.onerror = () => {
    document.getElementById('conn-status').textContent = 'reconnecting…'
    document.getElementById('conn-dot').style.background = 'var(--warn)'
    es.close(); es = null
    if (!_reconnectTimer) _reconnectTimer = setTimeout(() => { _reconnectTimer = null; connect() }, 3000)
  }
  es.addEventListener('stats', e => {
    const d = JSON.parse(e.data)
    updateStats(d)
  })
  es.addEventListener('log', e => {
    const d = JSON.parse(e.data)
    appendLog(d.level, d.msg)
  })
  es.addEventListener('agents', e => {
    const d = JSON.parse(e.data)
    renderAgents(d)
  })
  es.addEventListener('tasks', e => {
    const d = JSON.parse(e.data)
    renderTasks(d)
  })
  es.addEventListener('health', e => {
    const d = JSON.parse(e.data)
    renderHealth(d)
  })
  es.addEventListener('skills', e => {
    const d = JSON.parse(e.data)
    renderSkills(d)
  })
  es.addEventListener('memory', e => {
    const d = JSON.parse(e.data)
    renderMemory(d)
  })
}

// ── Stats ───────────────────────────────────────────────────────────────────
function updateStats(d) {
  document.getElementById('stat-tokens').textContent = fmtNum(d.dailyTokens ?? 0)
  document.getElementById('stat-cost').textContent = '$' + ((d.dailyCost ?? 0).toFixed(3))
  document.getElementById('stat-sessions').textContent = d.activeSessions ?? 0
  const age = Math.floor((Date.now() - startTime) / 1000)
  document.getElementById('uptime-badge').textContent = 'up ' + fmtUptime(age)
  const sb = document.getElementById('sidebar-stats')
  sb.innerHTML = [
    'Daily tokens: ' + fmtNum(d.dailyTokens ?? 0),
    'Hourly tokens: ' + fmtNum(d.hourlyTokens ?? 0),
    'Memories: ' + (d.memoryCount ?? '—'),
    'Queue depth: ' + (d.queueDepth ?? 0),
  ].join('<br>')
  if (d.tokenHistory) updateChart(tokenChart, d.tokenHistory)
  if (d.costHistory) updateChart(costChart, d.costHistory)
}

// ── Charts ──────────────────────────────────────────────────────────────────
function makeChart(id, label, color) {
  const ctx = document.getElementById(id).getContext('2d')
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label, data: [], borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.4, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6b7280', font: { size: 10 } } } } }
  })
}
function updateChart(chart, history) {
  chart.data.labels = history.map(h => h.label)
  chart.data.datasets[0].data = history.map(h => h.value)
  chart.update('none')
}

// ── Log ─────────────────────────────────────────────────────────────────────
function appendLog(level, msg) {
  const el = document.getElementById('log-area')
  const div = document.createElement('div')
  div.className = 'log-line'
  const ts = new Date().toTimeString().slice(0,8)
  div.innerHTML = \`<span class="log-ts">\${ts}</span><span class="log-level-\${level}">\${escHtml(msg)}</span>\`
  el.appendChild(div)
  if (el.children.length > 200) el.removeChild(el.firstChild)
  el.scrollTop = el.scrollHeight
}

// ── Agents ──────────────────────────────────────────────────────────────────
function renderAgents(agents) {
  const el = document.getElementById('agents-list')
  el.innerHTML = agents.map(a => \`
    <div class="agent-row">
      <div class="agent-dot \${a.active ? 'agent-dot-active' : 'agent-dot-idle'}"></div>
      <div class="agent-name">\${escHtml(a.name)} <span style="color:var(--muted);font-size:10px">(\${escHtml(a.id)})</span></div>
      <div style="color:var(--muted);font-size:10px">\${escHtml(a.model ?? '')}</div>
      <div>\${a.active ? '<span class="badge badge-ok">active</span>' : '<span class="badge badge-muted">idle</span>'}</div>
    </div>
  \`).join('')
}

// ── Tasks ───────────────────────────────────────────────────────────────────
function renderTasks(data) {
  if (data.scheduled) {
    document.getElementById('task-tbody').innerHTML = data.scheduled.length === 0
      ? '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:12px">No scheduled tasks.</td></tr>'
      : data.scheduled.map(t => \`
        <tr>
          <td>\${escHtml(t.name ?? t.id)}</td>
          <td style="color:var(--accent2);font-size:11px">\${escHtml(t.schedule ?? t.cron_expr ?? '')}</td>
          <td style="color:var(--muted);font-size:11px">\${escHtml(t.agent_id ?? '—')}</td>
          <td style="font-size:11px">\${t.next_run ? new Date(t.next_run).toLocaleString() : '—'}</td>
          <td>\${{ active:'<span class="badge badge-ok">active</span>', paused:'<span class="badge badge-muted">paused</span>', running:'<span class="badge badge-warn">running</span>', failed:'<span class="badge badge-err">failed</span>' }[t.status] ?? '<span class="badge badge-muted">' + escHtml(t.status) + '</span>'}</td>
        </tr>
      \`).join('')
  }
  if (data.missions) {
    document.getElementById('mission-tbody').innerHTML = data.missions.length === 0
      ? '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:12px">No missions yet.</td></tr>'
      : data.missions.map(t => {
        const pBadge = { critical:'badge-err', high:'badge-warn', medium:'badge-muted', low:'badge-muted' }[t.priority_label] ?? 'badge-muted'
        return \`
          <tr>
            <td>\${escHtml(t.title ?? t.id)}</td>
            <td style="color:var(--muted);font-size:11px">\${escHtml(t.agent_id ?? '—')}</td>
            <td><span class="badge \${pBadge}">\${escHtml(t.priority_label ?? 'medium')}</span></td>
            <td>\${{ pending:'<span class="badge badge-muted">pending</span>', running:'<span class="badge badge-warn">running</span>', completed:'<span class="badge badge-ok">done</span>', failed:'<span class="badge badge-err">failed</span>' }[t.status] ?? escHtml(t.status)}</td>
            <td style="color:var(--muted);font-size:11px">\${timeAgo(t.created_at)}</td>
          </tr>
        \`
      }).join('')
  }
}

async function createMission() {
  const title = document.getElementById('new-mission-title').value.trim()
  const prompt = document.getElementById('new-mission-prompt').value.trim()
  const agentId = document.getElementById('new-mission-agent').value
  const priority = document.getElementById('new-mission-priority').value
  if (!title || !prompt) { alert('Title and prompt are required.'); return }
  const res = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ title, prompt, agentId, priority }),
  })
  const data = await res.json()
  if (data.ok) {
    document.getElementById('new-mission-title').value = ''
    document.getElementById('new-mission-prompt').value = ''
    const msg = document.getElementById('mission-create-msg')
    msg.style.display = 'block'
    setTimeout(() => { msg.style.display = 'none' }, 3000)
    const fresh = await fetch('/api/tasks?token=' + TOKEN).then(r => r.json())
    renderTasks(fresh)
  } else {
    alert('Error: ' + data.error)
  }
}

async function createTask() {
  const name = document.getElementById('new-task-name').value.trim()
  const prompt = document.getElementById('new-task-prompt').value.trim()
  const cronExpr = document.getElementById('new-task-cron').value.trim()
  const agentId = document.getElementById('new-task-agent').value
  if (!prompt || !cronExpr) { alert('Prompt and cron expression are required.'); return }
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ name, prompt, cronExpr, agentId }),
  })
  const data = await res.json()
  if (data.ok) {
    document.getElementById('new-task-name').value = ''
    document.getElementById('new-task-prompt').value = ''
    document.getElementById('new-task-cron').value = ''
    const msg = document.getElementById('task-create-msg')
    msg.style.display = 'block'
    setTimeout(() => { msg.style.display = 'none' }, 3000)
    const fresh = await fetch('/api/tasks?token=' + TOKEN).then(r => r.json())
    renderTasks(fresh)
  } else {
    alert('Error: ' + data.error)
  }
}

// ── Skills ──────────────────────────────────────────────────────────────────
function renderSkills(skills) {
  const el = document.getElementById('skills-list')
  const countEl = document.getElementById('skill-count')
  if (countEl) countEl.textContent = skills.length + ' loaded'
  el.innerHTML = skills.map(s => \`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px">
      <div style="font-weight:600;font-size:12px">\${escHtml(s.name)}</div>
      <div style="color:var(--accent2);font-size:10px;margin-bottom:4px">\${escHtml(s.category ?? 'general')}</div>
      <div style="color:var(--muted);font-size:11px;line-height:1.4">\${escHtml(s.description || '(no description)')}</div>
    </div>
  \`).join('')
}
// ── Memory ───────────────────────────────────────────────────────────────────
function renderMemory(data) {
  const s = data.stats ?? {}
  document.getElementById('memory-stats').innerHTML = [
    'Total memories: <b style="color:var(--text)">' + (s.total ?? 0) + '</b>',
    'Pinned: <b style="color:var(--accent)">' + (s.pinned ?? 0) + '</b>',
    'Pending consolidation: <b style="color:var(--warn)">' + (s.unconsolidated ?? 0) + '</b>',
    'Avg importance: <b style="color:var(--accent2)">' + ((s.avgImportance ?? 0) * 100).toFixed(0) + '%</b>',
    'Active chats: <b style="color:var(--text)">' + (s.chatCount ?? 0) + '</b>',
  ].join('<br>')

  const cons = data.consolidations ?? []
  if (cons.length === 0) {
    document.getElementById('consolidation-info').innerHTML = '<span style="color:var(--muted)">No consolidations yet.</span>'
  } else {
    document.getElementById('consolidation-info').innerHTML = cons.map(c => \`
      <div style="border-bottom:1px solid var(--border);padding:8px 0">
        <div style="color:var(--muted);font-size:10px;margin-bottom:4px">\${escHtml(c.chat_id)} · \${timeAgo(c.created_at)}</div>
        <div style="margin-bottom:4px">\${escHtml(c.summary ?? '')}</div>
        \${c.insight ? '<div style="color:var(--accent2);font-size:11px">💡 ' + escHtml(c.insight) + '</div>' : ''}
      </div>
    \`).join('')
  }

  const rows = data.memories ?? []
  document.getElementById('memory-tbody').innerHTML = rows.length === 0
    ? '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px">No memories stored yet.</td></tr>'
    : rows.map(m => \`
      <tr>
        <td style="color:var(--muted);font-size:11px">\${escHtml(m.chat_id)}</td>
        <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${escHtml(m.summary ?? '')}</td>
        <td><span class="badge \${importanceBadge(m.importance)}">\${((m.importance ?? 0) * 100).toFixed(0)}%</span></td>
        <td>\${m.pinned ? '<span class="badge badge-ok">📌</span>' : '<span style="color:var(--muted)">—</span>'}</td>
        <td style="color:var(--muted);font-size:11px">\${timeAgo(m.created_at)}</td>
      </tr>
    \`).join('')
}

function importanceBadge(v) {
  if (v >= 0.7) return 'badge-ok'
  if (v >= 0.4) return 'badge-warn'
  return 'badge-muted'
}

function timeAgo(ts) {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

async function addMemory() {
  const text = document.getElementById('new-memory-text').value.trim()
  const chatId = document.getElementById('new-memory-chat').value
  const status = document.getElementById('memory-save-status')
  if (!text) { status.textContent = 'Enter a fact first.'; status.style.color = 'var(--err)'; status.style.display = 'inline'; return }
  status.textContent = 'Saving…'; status.style.color = 'var(--muted)'; status.style.display = 'inline'
  try {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ text, chatId }),
    })
    const data = await res.json()
    if (data.ok) {
      status.textContent = '📌 Saved: ' + data.summary
      status.style.color = 'var(--ok)'
      document.getElementById('new-memory-text').value = ''
      const fresh = await fetch('/api/memory?token=' + TOKEN).then(r => r.json())
      renderMemory(fresh)
    } else {
      status.textContent = 'Error: ' + data.error
      status.style.color = 'var(--err)'
    }
  } catch (err) {
    status.textContent = 'Error: ' + err.message
    status.style.color = 'var(--err)'
  }
  setTimeout(() => { status.style.display = 'none' }, 5000)
}

async function reloadSkills() {
  const res = await fetch('/api/skills/reload', { method:'POST', headers:{ 'Authorization':'Bearer '+TOKEN } })
  const data = await res.json()
  const fresh = await fetch('/api/skills?token=' + TOKEN).then(r => r.json())
  renderSkills(fresh)
}

// ── Health ──────────────────────────────────────────────────────────────────
const HEALTH_CATEGORIES = {
  llm:            { label: 'LLM APIs',        icon: '🤖' },
  voice:          { label: 'Voice',            icon: '🎙' },
  messaging:      { label: 'Messaging',        icon: '💬' },
  local:          { label: 'Local Services',   icon: '⚙️' },
  infrastructure: { label: 'Infrastructure',   icon: '🏗' },
}

function renderHealth(data) {
  const services = Array.isArray(data) ? data : (data.services ?? [])
  const checkedAt = data.checkedAt
  if (checkedAt) {
    document.getElementById('health-checked-at').textContent = 'checked ' + timeAgo(checkedAt)
  }

  const groups = {}
  for (const s of services) {
    const cat = s.category ?? 'local'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(s)
  }

  const order = ['llm', 'voice', 'messaging', 'infrastructure', 'local']
  let html = ''
  for (const cat of order) {
    if (!groups[cat]?.length) continue
    const meta = HEALTH_CATEGORIES[cat] ?? { label: cat, icon: '○' }
    html += \`<div style="margin-bottom:16px">
      <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">\${meta.icon} \${meta.label}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px">\`
    for (const s of groups[cat]) {
      html += renderServiceCard(s)
    }
    html += '</div></div>'
  }
  document.getElementById('service-health').innerHTML = html || '<span style="color:var(--muted)">No services.</span>'
}

function renderServiceCard(s) {
  if (!s.configured) {
    return \`<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;opacity:.5">
      <span style="color:var(--muted)">○</span>
      <span style="margin-left:6px">\${escHtml(s.service)}</span>
      <span style="float:right;font-size:10px;color:var(--muted)">not configured</span>
    </div>\`
  }
  const ok = s.reachable !== false
  const border = ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'
  const icon = ok ? '<span style="color:var(--ok)">✓</span>' : '<span style="color:var(--err)">✗</span>'
  const latency = s.latencyMs != null ? \`<span style="color:var(--muted);font-size:10px">\${s.latencyMs}ms</span>\` : ''
  const errLine = s.error ? \`<div style="color:var(--err);font-size:10px;margin-top:2px">\${escHtml(s.error)}</div>\` : ''
  const metaLine = s.meta ? renderMeta(s.meta) : ''
  // WhatsApp: show QR button when configured but not yet connected
  const waBtn = (s.service === 'WhatsApp' && !ok)
    ? \`<button class="btn" style="font-size:10px;padding:2px 8px;margin-top:6px" onclick="openQrModal()">Scan QR</button>\`
    : ''
  return \`<div style="background:var(--bg);border:1px solid \${border};border-radius:6px;padding:8px 12px">
    <div style="display:flex;align-items:center;gap:6px">
      \${icon}
      <span>\${escHtml(s.service)}</span>
      <span style="margin-left:auto">\${latency}</span>
    </div>
    \${errLine}\${metaLine}\${waBtn}
  </div>\`
}

function renderMeta(meta) {
  const parts = []
  if (meta.mode) parts.push(\`mode: \${escHtml(meta.mode)}\`)
  if (meta.pipecat != null) parts.push(\`pipecat: \${meta.pipecat ? '✓' : '✗'}\`)
  if (meta.gemini_live != null) parts.push(\`gemini live: \${meta.gemini_live ? '✓' : '✗'}\`)
  if (!parts.length) return ''
  return \`<div style="color:var(--muted);font-size:10px;margin-top:3px">\${parts.join(' · ')}</div>\`
}

async function refreshHealth() {
  document.getElementById('health-checked-at').textContent = 'checking…'
  const data = await fetch('/api/health?token=' + TOKEN).then(r => r.json())
  renderHealth(data)
}

// ── Chat History ────────────────────────────────────────────────────────────
let _historyChats = []
let _activeChatId = null
let _historyOffset = 0

async function loadHistory() {
  _historyChats = await fetch('/api/history?token=' + TOKEN).then(r => r.json())
  renderHistoryChatList(_historyChats)
}

function renderHistoryChatList(chats) {
  const el = document.getElementById('history-chat-list')
  if (!chats.length) { el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">No conversations yet.</div>'; return }
  el.innerHTML = chats.map(c => \`
    <div onclick="openHistoryChat('\${escHtml(c.chat_id)}')"
         id="hchat-\${CSS.escape(c.chat_id)}"
         style="padding:8px 10px;border-radius:4px;cursor:pointer;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:600">\${escHtml(fmtChatId(c.chat_id))}</span>
        <span style="color:var(--muted);font-size:10px">\${timeAgo(c.last_at)}</span>
      </div>
      <div style="color:var(--muted);font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${escHtml((c.preview ?? '').slice(0, 80))}</div>
      <div style="color:var(--muted);font-size:10px;margin-top:1px">\${c.msg_count} messages</div>
    </div>
  \`).join('')
}

function filterHistoryChats() {
  const q = document.getElementById('history-search').value.toLowerCase()
  const filtered = _historyChats.filter(c => c.chat_id.toLowerCase().includes(q) || (c.preview ?? '').toLowerCase().includes(q))
  renderHistoryChatList(filtered)
}

async function openHistoryChat(chatId) {
  _activeChatId = chatId
  _historyOffset = 0
  document.getElementById('history-chat-title').textContent = fmtChatId(chatId)
  document.getElementById('history-messages').innerHTML = ''
  document.getElementById('history-load-more').style.display = 'none'
  // highlight selected
  document.querySelectorAll('#history-chat-list > div').forEach(el => el.style.background = '')
  const sel = document.getElementById('hchat-' + CSS.escape(chatId))
  if (sel) sel.style.background = 'rgba(108,99,255,.1)'
  await fetchHistoryPage()
}

async function fetchHistoryPage() {
  const msgs = await fetch(\`/api/history/\${encodeURIComponent(_activeChatId)}?limit=60&offset=\${_historyOffset}&token=\${TOKEN}\`).then(r => r.json())
  if (!msgs.length) return
  const container = document.getElementById('history-messages')
  const fragment = document.createDocumentFragment()
  msgs.forEach(m => {
    const div = document.createElement('div')
    div.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(30,34,53,.4)'
    const isUser = m.role === 'user'
    div.innerHTML = \`
      <div style="display:flex;gap:6px;align-items:baseline;margin-bottom:2px">
        <span style="font-size:10px;font-weight:600;color:\${isUser ? 'var(--accent)' : 'var(--accent2)'}">\${isUser ? 'USER' : escHtml(m.agent_id ?? 'AGENT')}</span>
        <span style="color:var(--muted);font-size:10px">\${new Date(m.created_at).toLocaleString()}</span>
      </div>
      <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word">\${escHtml(m.content.slice(0, 800))}\${m.content.length > 800 ? '<span style="color:var(--muted)">…</span>' : ''}</div>
    \`
    fragment.appendChild(div)
  })
  container.appendChild(fragment)
  container.scrollTop = container.scrollHeight
  _historyOffset += msgs.length
  document.getElementById('history-load-more').style.display = msgs.length === 60 ? 'inline-block' : 'none'
}

async function loadMoreHistory() {
  if (!_activeChatId) return
  await fetchHistoryPage()
}

function fmtChatId(id) {
  if (!id) return '—'
  if (id.startsWith('wa:')) return '📱 WhatsApp ' + id.replace(/^wa:/, '').replace(/@c\.us$/, '')
  if (/^\d{7,}$/.test(id)) return '✈️ Telegram ' + id
  return id
}

// ── WhatsApp QR ─────────────────────────────────────────────────────────────
let _qrPollTimer = null

async function openQrModal() {
  document.getElementById('qr-modal').classList.add('open')
  document.getElementById('qr-status').textContent = 'Loading QR code…'
  document.getElementById('qr-canvas').innerHTML = ''
  await fetchAndRenderQr()
  // Poll every 10s in case QR refreshes or connection comes up
  _qrPollTimer = setInterval(fetchAndRenderQr, 10000)
}

function closeQrModal(e) {
  if (e.target.id !== 'qr-modal') return
  document.getElementById('qr-modal').classList.remove('open')
  clearInterval(_qrPollTimer)
  _qrPollTimer = null
}

async function fetchAndRenderQr() {
  try {
    const d = await fetch('/api/whatsapp/qr?token=' + TOKEN).then(r => r.json())
    if (d.connected) {
      document.getElementById('qr-status').textContent = '✓ WhatsApp connected!'
      document.getElementById('qr-canvas').innerHTML = '<span style="font-size:2rem">✅</span>'
      clearInterval(_qrPollTimer)
      // Refresh health card
      const health = await fetch('/api/health?token=' + TOKEN).then(r => r.json())
      renderHealth(health)
      return
    }
    if (!d.qr) {
      document.getElementById('qr-status').textContent = 'Waiting for QR code… (WhatsApp may still be initialising)'
      return
    }
    document.getElementById('qr-canvas').innerHTML = ''
    new QRCode(document.getElementById('qr-canvas'), {
      text: d.qr,
      width: 220,
      height: 220,
      colorDark: '#000',
      colorLight: '#fff',
      correctLevel: QRCode.CorrectLevel.L,
    })
    document.getElementById('qr-status').textContent = 'QR valid ~30s — scan quickly'
  } catch (err) {
    document.getElementById('qr-status').textContent = 'Error: ' + err.message
  }
}

// ── Console ──────────────────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chat-input')
  const msg = input.value.trim()
  if (!msg) return
  input.value = ''
  appendChatMsg('user', msg)
  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ message: msg }),
  })
  const data = await res.json()
  appendChatMsg('bot', data.reply ?? '(no reply)')
}

function sendCmd(cmd) { document.getElementById('chat-input').value = cmd; sendChat() }

function appendChatMsg(who, text) {
  const el = document.getElementById('chat-messages')
  const ts = new Date().toTimeString().slice(0,8)
  el.innerHTML += \`<div><span class="msg-ts">\${ts}</span><span class="msg-\${who}">\${escHtml(text)}</span></div>\`
  el.scrollTop = el.scrollHeight
}

// ── Navigation ───────────────────────────────────────────────────────────────
const SECTION_GUIDE = {
  overview: {
    icon: '📊', title: 'OVERVIEW',
    desc: 'Real-time system dashboard. Monitor token usage and cost for today, active chat sessions, and a live streaming log of all agent activity. Charts update every 15 seconds.',
    actions: ['View daily token spend','Track hourly cost','Monitor active sessions','Watch live agent log','Check uptime'],
  },
  agents: {
    icon: '🤖', title: 'AGENTS',
    desc: 'All registered AI agents and their current state. Each agent is a specialized Claude instance: Orchestrator routes tasks and handles general queries; Comms drafts messages and communications; Content writes articles and docs; Ops executes system tasks and scripts; Research investigates and analyzes topics.',
    actions: ['See which agents are active','View assigned models','Identify idle vs running agents','Trigger via Console or Telegram: @comms, @ops, @research'],
  },
  skills: {
    icon: '🛠', title: 'SKILLS',
    desc: 'Loaded skill playbooks that extend agent capabilities. Skills are markdown files in .agent/skills/ — they inject specialized knowledge (sales workflows, brand guidelines, MCP development patterns) into agents at runtime. Adding a new SKILL.md file and clicking Reload makes it immediately available.',
    actions: ['Browse all loaded skills','See skill categories','Reload after adding new skills','Invoke a skill via Telegram: /skill <name>','Skills active: content-ops, annuity-life-insurance-sales, mcp-builder, git-workflow, and more'],
  },
  tasks: {
    icon: '📋', title: 'TASKS',
    desc: 'Automation center. Missions are one-off agent jobs (execute once, track result). Scheduled Tasks are cron-based recurring jobs — set a cron expression and an agent runs the prompt on that schedule automatically, even with no one watching.',
    actions: ['Create a mission with title + prompt + agent','Schedule a recurring task with cron','Common crons: 0 9 * * * (daily 9am) · 0 9 * * 1 (weekly Mon)','View mission queue and scheduled task next-run times','Also available via Telegram: /missions, /tasks, /schedule'],
  },
  memory: {
    icon: '🧠', title: 'MEMORY',
    desc: "The AI's persistent long-term memory. Every conversation is automatically analyzed by Gemini — key facts are extracted, embedded, and stored. Before every response, the system searches memories semantically and injects relevant context. Pinned memories (importance 1.0) are always injected and never expire.",
    actions: ['Add Memory: type a fact → Save & Pin','View top memories by importance score','Pinned memories persist forever across all sessions','Auto-saved memories decay after 30 days if importance < 0.3','Telegram: /remember <fact> · /memory · /pin <id> · /forget'],
  },
  console: {
    icon: '💬', title: 'CONSOLE',
    desc: 'Direct browser chat with ClaudeClaw OS — equivalent to your Telegram conversation. All commands and agent routing work here. Type a message or any slash command. Responses are saved to conversation history and memory.',
    actions: ['Chat directly with the orchestrator','Use @agentName to route to a specific agent','Run commands: /status /health /memory /agents /tasks /missions /skills','All responses saved to History tab','Works offline from Telegram'],
  },
  history: {
    icon: '📜', title: 'HISTORY',
    desc: 'Full conversation archive across all channels. Browse every past session — Telegram, WhatsApp, and Console — with full message threading. Search and filter by chat ID. Channel labels show source: ✈️ Telegram, 📱 WhatsApp.',
    actions: ['Browse all past conversations','Filter by channel or keyword','Read full message threads','See user vs agent turns with timestamps','Load older messages with pagination'],
  },
  services: {
    icon: '🔌', title: 'SERVICES',
    desc: 'Live health dashboard for all integrated APIs and local services. External APIs are pinged on refresh and latency is shown. Local services (Database, Scheduler, Memory Loop) reflect live process state. WhatsApp shows a scannable QR code when not yet linked.',
    actions: ['Refresh to re-ping all APIs','Check LLM API connectivity: Anthropic · Gemini · Groq','Check Voice APIs: Deepgram · Cartesia · ElevenLabs','Scan WhatsApp QR code from browser','Monitor local services: DB · Scheduler · Memory Loop · War Room'],
  },
  usage: {
    icon: '💰', title: 'USAGE & COST',
    desc: 'Full Claude Code token usage and cost breakdown from your local JSONL transcripts. Scans ~/.claude/projects/**/*.jsonl and stores data in ~/.claude/usage.db. Costs are estimated using Anthropic API pricing — actual costs for Max/Pro subscribers may differ.',
    actions: ['Click Scan to index new sessions','Filter by time range: 7d / 30d / 90d / All','Filter by model family with chips','View daily stacked bar chart','Sort cost by model or project','Export sessions to CSV'],
  },
}

let _guideCollapsed = false

function toggleGuide() {
  _guideCollapsed = !_guideCollapsed
  document.getElementById('section-guide').classList.toggle('collapsed', _guideCollapsed)
  document.getElementById('guide-toggle').textContent = _guideCollapsed ? '▲ show' : '▼ hide'
}

function updateGuide(name) {
  const g = SECTION_GUIDE[name]
  if (!g) return
  document.getElementById('guide-icon').textContent = g.icon
  document.getElementById('guide-title').textContent = g.title
  document.getElementById('guide-desc').textContent = g.desc
  document.getElementById('guide-actions').innerHTML = g.actions.map(a => \`<span class="guide-chip">\${escHtml(a)}</span>\`).join('')
  if (_guideCollapsed) {
    _guideCollapsed = false
    document.getElementById('section-guide').classList.remove('collapsed')
    document.getElementById('guide-toggle').textContent = '▼ hide'
  }
}

function showSection(name, navEl) {
  ['overview','agents','skills','tasks','memory','console','history','services','usage'].forEach(s => {
    const el = document.getElementById('sec-' + s)
    if (el) el.style.display = s === name ? '' : 'none'
  })
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  if (navEl) navEl.classList.add('active')
  updateGuide(name)
  if (name === 'services') refreshHealth()
  if (name === 'tasks') fetch('/api/tasks?token=' + TOKEN).then(r => r.json()).then(renderTasks)
  if (name === 'memory') fetch('/api/memory?token=' + TOKEN).then(r => r.json()).then(renderMemory)
  if (name === 'agents') fetch('/api/agents?token=' + TOKEN).then(r => r.json()).then(renderAgents)
  if (name === 'skills') fetch('/api/skills?token=' + TOKEN).then(r => r.json()).then(renderSkills)
  if (name === 'history') loadHistory()
  if (name === 'usage') uLoad()
}

// ── Utils ────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function fmtNum(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'k'
  return String(n)
}
function fmtUptime(s) {
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s/60) + 'm'
  return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm'
}

// ── Usage & Cost ─────────────────────────────────────────────────────────────
const U_PRICING = {
  'claude-opus-4-6':   { input:5.00,output:25.00,cache_write:6.25,cache_read:0.50 },
  'claude-opus-4-5':   { input:5.00,output:25.00,cache_write:6.25,cache_read:0.50 },
  'claude-sonnet-4-6': { input:3.00,output:15.00,cache_write:3.75,cache_read:0.30 },
  'claude-sonnet-4-5': { input:3.00,output:15.00,cache_write:3.75,cache_read:0.30 },
  'claude-haiku-4-5':  { input:1.00,output:5.00, cache_write:1.25,cache_read:0.10 },
  'claude-haiku-4-6':  { input:1.00,output:5.00, cache_write:1.25,cache_read:0.10 },
}
const U_MODEL_COLORS = ['#6c63ff','#00d4aa','#f59e0b','#ef4444','#4f8ef7','#a78bfa','#34d399','#f472b6']
const U_TOKEN_COLORS = { input:'rgba(108,99,255,0.8)',output:'rgba(0,212,170,0.8)',cache_read:'rgba(74,222,128,0.5)',cache_creation:'rgba(245,158,11,0.5)' }

let uRawData = null
let uRange = '7d'
let uSelectedModels = new Set()
let uModelSortCol = 'cost', uModelSortDir = 'desc'
let uSessSortCol = 'last', uSessSortDir = 'desc'
let uCharts = {}
let uFilteredSessions = []

function uGetPricing(model) {
  if (!model) return null
  if (U_PRICING[model]) return U_PRICING[model]
  for (const k of Object.keys(U_PRICING)) { if (model.startsWith(k)) return U_PRICING[k] }
  const m = model.toLowerCase()
  if (m.includes('opus'))   return U_PRICING['claude-opus-4-6']
  if (m.includes('sonnet')) return U_PRICING['claude-sonnet-4-6']
  if (m.includes('haiku'))  return U_PRICING['claude-haiku-4-5']
  return null
}
function uCalcCost(model,inp,out,cr,cc) {
  const p = uGetPricing(model); if (!p) return 0
  return inp*p.input/1e6 + out*p.output/1e6 + cr*p.cache_read/1e6 + cc*p.cache_write/1e6
}
function uFmt(n) {
  if (n>=1e9) return (n/1e9).toFixed(2)+'B'
  if (n>=1e6) return (n/1e6).toFixed(2)+'M'
  if (n>=1e3) return (n/1e3).toFixed(1)+'K'
  return String(n)
}
function uFmtCost(c) { return '$'+c.toFixed(4) }
function uFmtCostBig(c) { return '$'+c.toFixed(2) }
function uCutoff() {
  if (uRange==='all') return null
  const d=new Date(); d.setDate(d.getDate()-(uRange==='7d'?7:uRange==='30d'?30:90))
  return d.toISOString().slice(0,10)
}

async function uLoad() {
  document.getElementById('u-scan-msg').textContent = 'loading…'
  try {
    const r = await fetch('/api/usage?token='+TOKEN)
    if (!r.ok) { document.getElementById('u-scan-msg').textContent = 'No data — click Scan'; return }
    uRawData = await r.json()
    document.getElementById('u-scan-msg').textContent = ''
    uBuildModelChips()
    uApply()
  } catch(e) {
    document.getElementById('u-scan-msg').textContent = 'Error loading usage data'
  }
}

async function uTriggerScan() {
  const btn = document.querySelector('#sec-usage .btn')
  document.getElementById('u-scan-msg').textContent = 'Scanning…'
  try {
    const r = await fetch('/api/usage/scan', { method:'POST', headers:{'Authorization':'Bearer '+TOKEN} })
    const d = await r.json()
    document.getElementById('u-scan-msg').textContent = d.ok ? 'Scan complete' : ('Error: '+d.message.slice(0,80))
    if (d.ok) uLoad()
  } catch(e) {
    document.getElementById('u-scan-msg').textContent = 'Scan failed'
  }
}

function uBuildModelChips() {
  if (!uRawData) return
  const container = document.getElementById('u-model-filters')
  container.innerHTML = ''
  uSelectedModels = new Set(uRawData.allModels)
  uRawData.allModels.forEach((m,i) => {
    const chip = document.createElement('label')
    chip.className = 'u-model-chip checked'
    chip.style.setProperty('--mc', U_MODEL_COLORS[i % U_MODEL_COLORS.length])
    chip.innerHTML = \`<input type="checkbox" checked style="display:none" onchange="uToggleModel('\${escHtml(m)}',this.checked)">\${escHtml(m)}\`
    container.appendChild(chip)
  })
}

function uToggleModel(m, on) {
  if (on) uSelectedModels.add(m); else uSelectedModels.delete(m)
  const chips = document.querySelectorAll('.u-model-chip')
  chips.forEach(c => { const inp = c.querySelector('input'); if (inp) c.classList.toggle('checked', inp.checked) })
  uApply()
}

function uSetRange(r) {
  uRange = r
  document.querySelectorAll('.ubtn-range').forEach(b => b.classList.toggle('active', b.id==='ubtn-'+r))
  uApply()
}

function uApply() {
  if (!uRawData) return
  const cutoff = uCutoff()
  // Filter daily rows
  const daily = uRawData.dailyByModel.filter(r =>
    uSelectedModels.has(r.model) && (!cutoff || r.day >= cutoff)
  )
  // Filter sessions
  uFilteredSessions = uRawData.sessions.filter(s =>
    uSelectedModels.has(s.model) && (!cutoff || s.last_date >= cutoff)
  )
  uRenderStats(daily)
  uRenderDailyChart(daily)
  uRenderModelChart(daily)
  uRenderProjectChart()
  uRenderModelTable(daily)
  uRenderSessTable()
}

function uRenderStats(daily) {
  const t = uRawData.totals
  document.getElementById('u-today-cost').textContent    = uFmtCostBig(t.todayCost)
  document.getElementById('u-total-cost').textContent    = uFmtCostBig(t.totalCost)
  document.getElementById('u-today-tokens').textContent  = uFmt(t.todayTokens)
  document.getElementById('u-total-sessions').textContent= String(t.totalSessions)
  document.getElementById('u-total-turns').textContent   = uFmt(t.totalTurns)
  document.getElementById('u-daily-title').textContent   = 'Daily Token Usage — '+uRange.toUpperCase()
}

function uRenderDailyChart(daily) {
  // Aggregate by day across all selected models
  const dayMap = {}
  for (const r of daily) {
    if (!dayMap[r.day]) dayMap[r.day] = { input:0,output:0,cache_read:0,cache_creation:0 }
    dayMap[r.day].input         += r.input
    dayMap[r.day].output        += r.output
    dayMap[r.day].cache_read    += r.cache_read
    dayMap[r.day].cache_creation+= r.cache_creation
  }
  const days = Object.keys(dayMap).sort()
  const datasets = [
    { label:'Input',         data:days.map(d=>dayMap[d].input),          backgroundColor:U_TOKEN_COLORS.input },
    { label:'Output',        data:days.map(d=>dayMap[d].output),         backgroundColor:U_TOKEN_COLORS.output },
    { label:'Cache Read',    data:days.map(d=>dayMap[d].cache_read),     backgroundColor:U_TOKEN_COLORS.cache_read },
    { label:'Cache Creation',data:days.map(d=>dayMap[d].cache_creation), backgroundColor:U_TOKEN_COLORS.cache_creation },
  ]
  if (uCharts.daily) uCharts.daily.destroy()
  const ctx = document.getElementById('u-chart-daily').getContext('2d')
  uCharts.daily = new Chart(ctx, {
    type:'bar',
    data:{ labels:days, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{
        x:{ stacked:true, ticks:{color:'#6b7280',maxTicksLimit:15,font:{size:10}}, grid:{color:'rgba(255,255,255,.04)'} },
        y:{ stacked:true, ticks:{color:'#6b7280',font:{size:10},callback:v=>uFmt(v)}, grid:{color:'rgba(255,255,255,.04)'} }
      },
      plugins:{ legend:{labels:{color:'#8892a4',font:{size:11},boxWidth:12}}, tooltip:{ callbacks:{ label:ctx=>' '+ctx.dataset.label+': '+uFmt(ctx.parsed.y) } } }
    }
  })
}

function uRenderModelChart(daily) {
  const modelTotals = {}
  for (const r of daily) {
    if (!modelTotals[r.model]) modelTotals[r.model] = 0
    modelTotals[r.model] += r.input + r.output + r.cache_read + r.cache_creation
  }
  const models = Object.keys(modelTotals).sort((a,b) => modelTotals[b]-modelTotals[a])
  if (uCharts.model) uCharts.model.destroy()
  const ctx = document.getElementById('u-chart-model').getContext('2d')
  uCharts.model = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: models,
      datasets:[{ data:models.map(m=>modelTotals[m]), backgroundColor:models.map((_,i)=>U_MODEL_COLORS[i%U_MODEL_COLORS.length]), borderWidth:0 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'right',labels:{color:'#8892a4',font:{size:11},boxWidth:12}}, tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+uFmt(ctx.parsed)}} }
    }
  })
}

function uRenderProjectChart() {
  const cutoff = uCutoff()
  const filtered = uRawData.sessions.filter(s => uSelectedModels.has(s.model) && (!cutoff||s.last_date>=cutoff))
  const projMap = {}
  for (const s of filtered) {
    if (!projMap[s.project]) projMap[s.project] = 0
    projMap[s.project] += s.input + s.output + s.cache_read + s.cache_creation
  }
  const projs = Object.keys(projMap).sort((a,b)=>projMap[b]-projMap[a]).slice(0,10)
  if (uCharts.project) uCharts.project.destroy()
  const ctx = document.getElementById('u-chart-project').getContext('2d')
  uCharts.project = new Chart(ctx, {
    type:'bar',
    data:{
      labels:projs.map(p=>p.length>28?p.slice(0,26)+'…':p),
      datasets:[{ label:'Tokens', data:projs.map(p=>projMap[p]), backgroundColor:'rgba(108,99,255,0.7)', borderRadius:3 }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      scales:{
        x:{ ticks:{color:'#6b7280',font:{size:10},callback:v=>uFmt(v)}, grid:{color:'rgba(255,255,255,.04)'} },
        y:{ ticks:{color:'#8892a4',font:{size:10}}, grid:{display:false} }
      },
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+uFmt(ctx.parsed.x)+' tokens'}} }
    }
  })
}

function uRenderModelTable(daily) {
  const map = {}
  for (const r of daily) {
    if (!map[r.model]) map[r.model] = {model:r.model,turns:0,input:0,output:0,cache_read:0,cache_creation:0,cost:0}
    const m = map[r.model]
    m.turns+=r.turns; m.input+=r.input; m.output+=r.output
    m.cache_read+=r.cache_read; m.cache_creation+=r.cache_creation
    m.cost += uCalcCost(r.model,r.input,r.output,r.cache_read,r.cache_creation)
  }
  let rows = Object.values(map)
  rows.sort((a,b) => uModelSortDir==='desc' ? b[uModelSortCol]-a[uModelSortCol] : a[uModelSortCol]-b[uModelSortCol])
  const tbody = document.getElementById('u-model-body')
  tbody.innerHTML = rows.map(r => \`<tr>
    <td><span style="color:var(--accent);font-family:monospace;font-size:11px">\${escHtml(r.model)}</span></td>
    <td class="num">\${r.turns}</td>
    <td class="num">\${uFmt(r.input)}</td>
    <td class="num">\${uFmt(r.output)}</td>
    <td class="num">\${uFmt(r.cache_read)}</td>
    <td class="num">\${uFmt(r.cache_creation)}</td>
    <td>\${r.cost>0?\`<span class="ucost">\${uFmtCost(r.cost)}</span>\`:\`<span class="ucost-na">n/a</span>\`}</td>
  </tr>\`).join('')
}

function uSetModelSort(col) {
  if (uModelSortCol===col) uModelSortDir = uModelSortDir==='desc'?'asc':'desc'
  else { uModelSortCol=col; uModelSortDir='desc' }
  ['turns','input','output','cache_read','cache_creation','cost'].forEach(c => {
    const el=document.getElementById('ums-'+c); if(el) el.textContent=c===uModelSortCol?(uModelSortDir==='desc'?'▼':'▲'):''
  })
  if (uRawData) uRenderModelTable(uRawData.dailyByModel.filter(r=>uSelectedModels.has(r.model)&&(!uCutoff()||r.day>=uCutoff())))
}

function uRenderSessTable() {
  let rows = [...uFilteredSessions]
  rows.sort((a,b) => {
    const av = uSessSortCol==='last'?a[uSessSortCol]:Number(a[uSessSortCol])
    const bv = uSessSortCol==='last'?b[uSessSortCol]:Number(b[uSessSortCol])
    return uSessSortDir==='desc'?(av<bv?1:-1):(av>bv?1:-1)
  })
  const tbody = document.getElementById('u-sess-body')
  tbody.innerHTML = rows.slice(0,100).map(s => \`<tr>
    <td style="font-family:monospace;font-size:11px;color:var(--muted)">\${escHtml(s.session_id)}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="\${escHtml(s.project)}">\${escHtml(s.project)}</td>
    <td style="color:var(--muted);font-size:11px">\${escHtml(s.last)}</td>
    <td style="color:var(--muted)">\${s.duration_min}m</td>
    <td><span style="font-family:monospace;font-size:10px;color:var(--accent2)">\${escHtml(s.model.replace('claude-',''))}</span></td>
    <td class="num">\${s.turns}</td>
    <td class="num">\${uFmt(s.input)}</td>
    <td class="num">\${uFmt(s.output)}</td>
    <td>\${s.cost>0?\`<span class="ucost">\${uFmtCost(s.cost)}</span>\`:\`<span class="ucost-na">n/a</span>\`}</td>
  </tr>\`).join('')
}

function uSetSessSort(col) {
  if (uSessSortCol===col) uSessSortDir = uSessSortDir==='desc'?'asc':'desc'
  else { uSessSortCol=col; uSessSortDir='desc' }
  ;['last','duration_min','turns','input','output','cost'].forEach(c => {
    const el=document.getElementById('uss-'+c); if(el) el.textContent=c===uSessSortCol?(uSessSortDir==='desc'?'▼':'▲'):''
  })
  uRenderSessTable()
}

function uExportCSV() {
  const rows = uFilteredSessions
  const header = 'session_id,project,last_active,duration_min,model,turns,input,output,cache_read,cache_creation,est_cost'
  const lines = rows.map(s => [s.session_id,s.project,s.last,s.duration_min,s.model,s.turns,s.input,s.output,s.cache_read,s.cache_creation,s.cost.toFixed(4)].join(','))
  const blob = new Blob([header+'\\n'+lines.join('\\n')], {type:'text/csv'})
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = 'claude-usage-'+uRange+'.csv'; a.click()
}

// ── Init ─────────────────────────────────────────────────────────────────────
connect() // connect first — don't let chart errors block SSE
try {
  tokenChart = makeChart('chart-tokens', 'Tokens', '#6c63ff')
  costChart = makeChart('chart-cost', 'Cost $', '#00d4aa')
} catch(e) { console.warn('Charts unavailable:', e) }
updateGuide('overview')
// Fallback watchdog — catches any case onerror missed
setInterval(() => {
  if (!es || es.readyState === EventSource.CLOSED) connect()
}, 10000)
</script>
</body>
</html>`
}
