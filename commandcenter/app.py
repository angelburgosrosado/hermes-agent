#!/usr/bin/env python3
"""
Command Center v2.0 - Full Hermes Integration
Local-First AI Workspace with complete agent capabilities.
"""

import streamlit as st
import subprocess
import json
import os
import datetime
import time
import re
import yaml
from pathlib import Path
import sounddevice as sd
import soundfile as sf
import numpy as np
import requests
import threading
from concurrent.futures import ThreadPoolExecutor

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

BASE_DIR = Path(os.environ.get("CC_DATA_DIR", str(Path.home() / "CommandCenter")))
CODE_DIR = Path(__file__).resolve().parent
REPO_DIR = CODE_DIR.parent
HERMES_DIR = Path.home() / ".hermes"
TASKS_DIR = BASE_DIR / "tasks"
IDEAS_DIR = BASE_DIR / "ideas"
AUDIO_DIR = BASE_DIR / "audio"
SCREENSHOTS_DIR = BASE_DIR / "screenshots"
CAPTURES_DIR = BASE_DIR / "captures"
EXPORTS_DIR = BASE_DIR / "exports"
PROJECTS_DIR = BASE_DIR / "projects"
AGENTS_DIR = BASE_DIR / "agents"

CLAUDECLAW_AGENTS_DIR = REPO_DIR / "agents"
CLAUDECLAW_SKILL_DIRS = [
    REPO_DIR / ".agent" / "skills",
    REPO_DIR / "skills",
    REPO_DIR / "optional-skills",
]

DASHBOARD_URL = os.environ.get("CC_DASHBOARD_URL", "http://localhost:3141")
WARROOM_URL = os.environ.get("CC_WARROOM_URL", "http://localhost:7860")
USAGE_DB = REPO_DIR / "usage" / "usage.db"

OLLAMA_URL = "http://localhost:11434"

# Ensure directories exist
for d in [TASKS_DIR, IDEAS_DIR, AUDIO_DIR, SCREENSHOTS_DIR, CAPTURES_DIR, EXPORTS_DIR, PROJECTS_DIR, AGENTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ══════════════════════════════════════════════════════════════════════════════
# PAGE CONFIG
# ══════════════════════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="Command Center + Hermes",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS - Dark theme with gold accents
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    }
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        background: linear-gradient(90deg, #ffd700, #ff8c00, #ffd700);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        padding: 1rem;
        text-shadow: 0 0 30px rgba(255,215,0,0.3);
    }
    .task-card {
        background: rgba(255,255,255,0.03);
        border-radius: 12px;
        padding: 1rem;
        margin: 0.5rem 0;
        border-left: 4px solid #ffd700;
        backdrop-filter: blur(10px);
    }
    .skill-card {
        background: linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,140,0,0.05));
        border-radius: 10px;
        padding: 0.75rem;
        margin: 0.25rem 0;
        border: 1px solid rgba(255,215,0,0.2);
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .skill-card:hover {
        border-color: #ffd700;
        transform: translateX(5px);
    }
    .model-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: rgba(255,215,0,0.15);
        border-radius: 15px;
        font-size: 0.8rem;
        color: #ffd700;
        border: 1px solid rgba(255,215,0,0.3);
    }
    .agent-status {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .agent-running { background: rgba(46,204,113,0.2); border-left: 3px solid #2ecc71; }
    .agent-idle { background: rgba(255,215,0,0.1); border-left: 3px solid #ffd700; }
    .agent-error { background: rgba(231,76,60,0.2); border-left: 3px solid #e74c3c; }
    .terminal-output {
        background: #0d1117;
        color: #c9d1d9;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.85rem;
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        white-space: pre-wrap;
        max-height: 400px;
        overflow-y: auto;
    }
    .hermes-response {
        background: linear-gradient(135deg, rgba(255,215,0,0.05), rgba(0,0,0,0.2));
        border: 1px solid rgba(255,215,0,0.2);
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1rem 0;
    }
    .category-header {
        color: #ffd700;
        font-weight: bold;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255,215,0,0.3);
        margin-bottom: 0.5rem;
    }
    .stat-card {
        background: rgba(255,255,255,0.03);
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
        border: 1px solid rgba(255,215,0,0.1);
    }
    .cron-job {
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        padding: 0.75rem;
        margin: 0.5rem 0;
        border-left: 3px solid #3498db;
    }
</style>
""", unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════════════════════════
# SESSION STATE
# ══════════════════════════════════════════════════════════════════════════════

if 'hermes_history' not in st.session_state:
    st.session_state.hermes_history = []
if 'active_agents' not in st.session_state:
    st.session_state.active_agents = {}
if 'current_skill' not in st.session_state:
    st.session_state.current_skill = None
if 'selected_model' not in st.session_state:
    st.session_state.selected_model = "gemma4:31b"

# ══════════════════════════════════════════════════════════════════════════════
# HERMES INTEGRATION FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_hermes_config():
    """Load Hermes configuration"""
    config_path = HERMES_DIR / "config.yaml"
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {}

def save_hermes_config(config):
    """Save Hermes configuration"""
    config_path = HERMES_DIR / "config.yaml"
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

def get_hermes_memory():
    """Get Hermes memory content"""
    memory_file = HERMES_DIR / "memory.md"
    if memory_file.exists():
        return memory_file.read_text()
    return ""

def get_user_profile():
    """Get Hermes user profile"""
    profile_file = HERMES_DIR / "user.md"
    if profile_file.exists():
        return profile_file.read_text()
    return ""

def run_hermes(prompt, skill=None, model=None, timeout=300):
    """Run Hermes with a prompt and optional skill"""
    cmd = ['hermes']
    
    if model:
        cmd.extend(['-m', model])
    
    if skill:
        prompt = f"/skill {skill}\n{prompt}"
    
    cmd.append(prompt)
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, 'HERMES_NONINTERACTIVE': '1'}
        )
        return {
            'success': result.returncode == 0,
            'output': result.stdout,
            'error': result.stderr
        }
    except subprocess.TimeoutExpired:
        return {'success': False, 'output': '', 'error': 'Timeout exceeded'}
    except Exception as e:
        return {'success': False, 'output': '', 'error': str(e)}

def run_hermes_streaming(prompt, skill=None, model=None):
    """Run Hermes with streaming output (generator)"""
    cmd = ['hermes']
    
    if model:
        cmd.extend(['-m', model])
    
    if skill:
        prompt = f"/skill {skill}\n{prompt}"
    
    cmd.append(prompt)
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, 'HERMES_NONINTERACTIVE': '1'}
    )
    
    for line in iter(process.stdout.readline, ''):
        yield line
    
    process.wait()

def _parse_skill_file(skill_path: Path, root: Path, source: str):
    skill_name = skill_path.parent.name
    try:
        content = skill_path.read_text()
    except Exception:
        return None

    description = ""
    rel = skill_path.parent.relative_to(root) if skill_path.is_relative_to(root) else skill_path.parent
    category = rel.parts[0] if len(rel.parts) > 1 else "general"

    if content.startswith("---"):
        try:
            end = content.find("---", 3)
            if end > 0:
                frontmatter = yaml.safe_load(content[3:end]) or {}
                description = frontmatter.get('description', '') or ''
        except Exception:
            pass

    if not description:
        for line in content.split('\n'):
            s = line.strip()
            if s and not s.startswith('#') and not s.startswith('---'):
                description = s[:100]
                break

    return {
        'name': skill_name,
        'description': description,
        'category': category,
        'source': source,
        'path': str(skill_path),
    }


SKILL_SOURCES = [
    (HERMES_DIR / "skills", "hermes"),
    (REPO_DIR / ".agent" / "skills", "claudeclaw"),
    (REPO_DIR / "skills", "claudeclaw"),
    (REPO_DIR / "optional-skills", "claudeclaw-optional"),
]


def get_all_skills():
    """Union skills from Hermes (~/.hermes/skills) + ClaudeClaw (.agent/skills, skills, optional-skills)."""
    seen = {}  # (source, name) -> entry, avoids double-listing
    for root, source in SKILL_SOURCES:
        if not root.exists():
            continue
        for skill_path in root.rglob("SKILL.md"):
            entry = _parse_skill_file(skill_path, root, source)
            if entry:
                seen[(source, entry['name'])] = entry
    return sorted(seen.values(), key=lambda x: (x['source'], x['category'], x['name']))


# Back-compat alias — older tabs call get_hermes_skills()
get_hermes_skills = get_all_skills


def get_skill_content(skill_name, source=None):
    """Get full content of a skill by name, optionally filtered by source."""
    for root, src in SKILL_SOURCES:
        if source and src != source:
            continue
        if not root.exists():
            continue
        for skill_path in root.rglob("SKILL.md"):
            if skill_path.parent.name == skill_name:
                return skill_path.read_text()
    return None


def get_claudeclaw_agents():
    """Scan Repo/agents/*/CLAUDE.md for commandeerable agents."""
    agents = []
    if not CLAUDECLAW_AGENTS_DIR.exists():
        return agents
    for agent_md in CLAUDECLAW_AGENTS_DIR.glob("*/CLAUDE.md"):
        name = agent_md.parent.name
        if name.startswith("_"):  # skip _template
            continue
        try:
            content = agent_md.read_text()
        except Exception:
            continue
        # First non-heading line = description
        description = ""
        for line in content.split('\n')[1:]:
            s = line.strip()
            if s and not s.startswith('#'):
                description = s[:140]
                break
        agents.append({
            'name': name,
            'description': description,
            'path': str(agent_md),
            'source': 'claudeclaw-agent',
        })
    return sorted(agents, key=lambda a: a['name'])

def get_hermes_sessions():
    """Get recent Hermes sessions"""
    try:
        result = subprocess.run(
            ['hermes', 'session', 'list', '--json'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except:
        pass
    return []

def get_cron_jobs():
    """Get Hermes cron jobs"""
    cron_file = HERMES_DIR / "cron" / "jobs.json"
    if cron_file.exists():
        return json.loads(cron_file.read_text())
    return []


def probe_service(url: str, timeout: float = 1.0):
    """Check if a service is reachable. Returns (alive, status_code_or_error)."""
    try:
        r = requests.get(url, timeout=timeout)
        return True, r.status_code
    except requests.exceptions.ConnectionError:
        return False, "offline"
    except Exception as e:
        return False, str(e)[:40]


def get_usage_summary():
    """Read usage.db for session/cost totals. Returns dict or None if DB missing."""
    if not USAGE_DB.exists():
        return None
    import sqlite3
    try:
        conn = sqlite3.connect(f"file:{USAGE_DB}?mode=ro", uri=True)
        cur = conn.cursor()
        # Table names inferred from usage/scanner.py — fall back gracefully.
        summary = {}
        tables = [r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        for t in tables:
            try:
                (count,) = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()
                summary[t] = count
            except Exception:
                pass
        # Try common cost/token columns
        for t in tables:
            cols = [c[1] for c in cur.execute(f"PRAGMA table_info({t})").fetchall()]
            for col in ("cost_usd", "total_cost", "cost"):
                if col in cols:
                    try:
                        (total,) = cur.execute(f"SELECT SUM({col}) FROM {t}").fetchone()
                        if total:
                            summary[f"{t}.{col}"] = round(total, 4)
                    except Exception:
                        pass
        conn.close()
        return summary
    except Exception:
        return None

def create_cron_job(name, schedule, prompt, deliver="local"):
    """Create a new cron job"""
    result = run_hermes(f'/cron create "{schedule}" {prompt}')
    return result

def get_ollama_models():
    """Get list of available Ollama models"""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if r.status_code == 200:
            return [m['name'] for m in r.json().get('models', [])]
    except:
        pass
    return ['gemma4:31b', 'llama3.3:latest', 'gpt-oss:120b']

def query_ollama(prompt, model="gemma4:31b", system="You are a helpful assistant.", stream=False):
    """Query local Ollama model"""
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "system": system,
                "stream": stream
            },
            timeout=120
        )
        if r.status_code == 200:
            return r.json().get('response', '')
    except Exception as e:
        return f"Error: {str(e)}"
    return "Error querying model"

def delegate_task(goal, context="", toolsets=None):
    """Spawn a Hermes subagent for a task"""
    if toolsets is None:
        toolsets = ["terminal", "file", "web"]
    
    prompt = f"""Delegate the following task to a subagent:

Goal: {goal}
Context: {context}
Toolsets: {', '.join(toolsets)}

Execute this task and report the results."""
    
    return run_hermes(prompt)

# ══════════════════════════════════════════════════════════════════════════════
# CAPTURE FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def record_audio(duration=10, sample_rate=16000):
    """Record audio from microphone"""
    recording = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
    sd.wait()
    return recording, sample_rate

def save_audio(recording, sample_rate, filename):
    """Save audio to file"""
    filepath = AUDIO_DIR / filename
    sf.write(str(filepath), recording, sample_rate)
    return filepath

def transcribe_audio(filepath):
    """Transcribe audio using local Whisper"""
    try:
        result = subprocess.run(
            ['whisper', str(filepath), '--model', 'small', '--language', 'en', '--output_format', 'txt', '--output_dir', str(filepath.parent)],
            capture_output=True, text=True, timeout=120
        )
        txt_file = filepath.with_suffix('.txt')
        if txt_file.exists():
            return txt_file.read_text().strip()
        return "Transcription completed but no output file found"
    except Exception as e:
        return f"Error: {str(e)}"

def take_screenshot():
    """Take screenshot using macOS screencapture"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = SCREENSHOTS_DIR / f"screenshot_{timestamp}.png"
    subprocess.run(['screencapture', '-x', str(filepath)], check=True)
    return filepath

def take_screen_selection():
    """Take selection screenshot"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = SCREENSHOTS_DIR / f"selection_{timestamp}.png"
    subprocess.run(['screencapture', '-i', str(filepath)])
    return filepath if filepath.exists() else None

# ══════════════════════════════════════════════════════════════════════════════
# DATA PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════

def load_tasks():
    tasks_file = TASKS_DIR / "tasks.json"
    if tasks_file.exists():
        return json.loads(tasks_file.read_text())
    return []

def save_tasks(tasks):
    tasks_file = TASKS_DIR / "tasks.json"
    tasks_file.write_text(json.dumps(tasks, indent=2))

def load_ideas():
    ideas_file = IDEAS_DIR / "ideas.json"
    if ideas_file.exists():
        return json.loads(ideas_file.read_text())
    return []

def save_ideas(ideas):
    ideas_file = IDEAS_DIR / "ideas.json"
    ideas_file.write_text(json.dumps(ideas, indent=2))

def load_projects():
    projects_file = PROJECTS_DIR / "projects.json"
    if projects_file.exists():
        return json.loads(projects_file.read_text())
    return []

def save_projects(projects):
    projects_file = PROJECTS_DIR / "projects.json"
    projects_file.write_text(json.dumps(projects, indent=2))

# ══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ══════════════════════════════════════════════════════════════════════════════

with st.sidebar:
    st.markdown("## 🎯 Command Center")
    st.markdown("#### + Hermes Agent")
    st.markdown("---")
    
    # Model selector
    models = get_ollama_models()
    all_models = models + ["anthropic/claude-opus-4-5-20251101", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro"]
    
    selected_model = st.selectbox(
        "🤖 Active Model",
        all_models,
        index=0 if 'gemma4:31b' in all_models else 0
    )
    st.session_state.selected_model = selected_model
    
    # Show if local or API
    if selected_model in models:
        st.markdown(f'<span class="model-badge">🏠 LOCAL</span>', unsafe_allow_html=True)
    else:
        st.markdown(f'<span class="model-badge">☁️ API</span>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Navigation
    page = st.radio(
        "Navigate",
        [
            "🏠 Dashboard",
            "💬 Hermes Chat",
            "🛠️ Skills Browser",
            "📋 Task Board",
            "🎤 Capture",
            "💡 Ideas Lab",
            "🌐 Website Builder",
            "🤖 Agent Spawner",
            "⏰ Cron Jobs",
            "🧠 Memory",
            "📊 Sessions",
            "⚙️ Settings"
        ],
        label_visibility="collapsed"
    )
    
    st.markdown("---")
    
    # Quick stats
    tasks = load_tasks()
    skills = get_hermes_skills()
    pending = len([t for t in tasks if t.get('status') == 'pending'])
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Tasks", pending)
    with col2:
        st.metric("Skills", len(skills))
    
    # Ollama status
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if r.status_code == 200:
            st.success("🟢 Ollama Online")
        else:
            st.warning("🟡 Ollama Issue")
    except:
        st.error("🔴 Ollama Offline")

# ══════════════════════════════════════════════════════════════════════════════
# MAIN CONTENT
# ══════════════════════════════════════════════════════════════════════════════

st.markdown('<p class="main-header">🎯 Command Center + Hermes</p>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

if page == "🏠 Dashboard":
    st.markdown("### 🏠 Dashboard")
    
    # Top stats row
    col1, col2, col3, col4, col5 = st.columns(5)
    
    tasks = load_tasks()
    ideas = load_ideas()
    skills = get_hermes_skills()
    audio_count = len(list(AUDIO_DIR.glob("*.wav")))
    screenshot_count = len(list(SCREENSHOTS_DIR.glob("*.png")))
    
    with col1:
        st.markdown('<div class="stat-card">', unsafe_allow_html=True)
        st.metric("📋 Tasks", len([t for t in tasks if t.get('status') == 'pending']))
        st.markdown('</div>', unsafe_allow_html=True)
    with col2:
        st.markdown('<div class="stat-card">', unsafe_allow_html=True)
        st.metric("💡 Ideas", len(ideas))
        st.markdown('</div>', unsafe_allow_html=True)
    with col3:
        st.markdown('<div class="stat-card">', unsafe_allow_html=True)
        st.metric("🛠️ Skills", len(skills))
        st.markdown('</div>', unsafe_allow_html=True)
    with col4:
        st.markdown('<div class="stat-card">', unsafe_allow_html=True)
        st.metric("🎤 Memos", audio_count)
        st.markdown('</div>', unsafe_allow_html=True)
    with col5:
        st.markdown('<div class="stat-card">', unsafe_allow_html=True)
        st.metric("📸 Captures", screenshot_count)
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown("---")

    # ClaudeClaw services strip
    st.markdown("#### 🐾 ClaudeClaw Services")
    cc_col1, cc_col2, cc_col3, cc_col4 = st.columns(4)

    dash_alive, dash_info = probe_service(DASHBOARD_URL)
    wr_alive, wr_info = probe_service(WARROOM_URL)
    cc_agents_count = len(get_claudeclaw_agents())
    usage = get_usage_summary()

    with cc_col1:
        icon = "🟢" if dash_alive else "🔴"
        st.markdown(f"**{icon} Dashboard**  \n`{DASHBOARD_URL}`  \n_{dash_info}_")
        if dash_alive:
            st.link_button("Open", DASHBOARD_URL, use_container_width=True)
    with cc_col2:
        icon = "🟢" if wr_alive else "🔴"
        st.markdown(f"**{icon} War Room**  \n`{WARROOM_URL}`  \n_{wr_info}_")
        if wr_alive:
            st.link_button("Open", WARROOM_URL, use_container_width=True)
    with cc_col3:
        st.metric("🤖 ClaudeClaw Agents", cc_agents_count)
        st.caption(", ".join(a['name'] for a in get_claudeclaw_agents()) or "(none)")
    with cc_col4:
        if usage is None:
            st.markdown("**💰 Usage DB**  \n_Not scanned yet_")
            st.caption(f"Run: `python {USAGE_DB.parent}/scanner.py`")
        else:
            # Prefer showing a cost total if we found one, else row counts
            cost_keys = [k for k in usage if '.cost' in k or k.endswith('_cost')]
            if cost_keys:
                total = sum(usage[k] for k in cost_keys)
                st.metric("💰 Total Cost (USD)", f"${total:.2f}")
            row_keys = [k for k in usage if '.' not in k]
            st.caption(" · ".join(f"{k}: {usage[k]}" for k in row_keys[:4]))

    st.markdown("---")

    # Two column layout
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### 🚀 Quick Actions")
        
        qa_col1, qa_col2 = st.columns(2)
        with qa_col1:
            if st.button("🎤 Voice Memo", use_container_width=True):
                st.session_state.quick_action = "voice"
            if st.button("📸 Screenshot", use_container_width=True):
                filepath = take_screenshot()
                st.success(f"Saved: {filepath.name}")
            if st.button("➕ New Task", use_container_width=True):
                st.session_state.quick_action = "task"
        with qa_col2:
            if st.button("💡 New Idea", use_container_width=True):
                st.session_state.quick_action = "idea"
            if st.button("💬 Ask Hermes", use_container_width=True):
                st.session_state.quick_action = "hermes"
            if st.button("🔄 Refresh", use_container_width=True):
                st.rerun()
        
        # Handle quick actions
        if hasattr(st.session_state, 'quick_action'):
            if st.session_state.quick_action == "task":
                new_task = st.text_input("Quick task:", key="dash_task")
                if st.button("Add", key="dash_task_btn") and new_task:
                    tasks = load_tasks()
                    tasks.append({
                        "id": len(tasks) + 1,
                        "title": new_task,
                        "priority": "🟡 Medium",
                        "status": "pending",
                        "created": datetime.datetime.now().isoformat()
                    })
                    save_tasks(tasks)
                    del st.session_state.quick_action
                    st.rerun()
            elif st.session_state.quick_action == "hermes":
                quick_prompt = st.text_input("Ask Hermes:", key="dash_hermes")
                if st.button("Send", key="dash_hermes_btn") and quick_prompt:
                    with st.spinner("Thinking..."):
                        result = query_ollama(quick_prompt, model=st.session_state.selected_model)
                        st.markdown(f'<div class="hermes-response">{result}</div>', unsafe_allow_html=True)
        
        st.markdown("---")
        st.markdown("#### 📋 Recent Tasks")
        for task in [t for t in tasks if t.get('status') == 'pending'][:5]:
            st.markdown(f"• {task['priority']} {task['title']}")
    
    with col2:
        st.markdown("#### 🤖 System Status")
        
        # Hermes config
        config = get_hermes_config()
        st.markdown(f"**Default Model:** `{config.get('model', {}).get('default', 'N/A')}`")
        st.markdown(f"**Provider:** `{config.get('model', {}).get('provider', 'N/A')}`")
        
        # Ollama models
        st.markdown("**Local Models:**")
        for m in get_ollama_models()[:5]:
            st.markdown(f"  • `{m}`")
        
        st.markdown("---")
        st.markdown("#### 🛠️ Popular Skills")
        popular = ["shopify-site-clone", "github-pr-workflow", "systematic-debugging", "youtube-content", "whisper"]
        for skill_name in popular:
            if st.button(f"📘 {skill_name}", key=f"pop_{skill_name}", use_container_width=True):
                st.session_state.current_skill = skill_name

# ─────────────────────────────────────────────────────────────────────────────
# HERMES CHAT
# ─────────────────────────────────────────────────────────────────────────────

elif page == "💬 Hermes Chat":
    st.markdown("### 💬 Hermes Chat")
    
    # Model and skill selection
    col1, col2, col3 = st.columns([2, 2, 1])
    with col1:
        chat_model = st.selectbox("Model", all_models, index=all_models.index(st.session_state.selected_model) if st.session_state.selected_model in all_models else 0, key="chat_model")
    with col2:
        skills = get_hermes_skills()
        skill_names = ["None"] + [s['name'] for s in skills]
        selected_skill = st.selectbox("Load Skill", skill_names, key="chat_skill")
    with col3:
        use_hermes = st.checkbox("Use Hermes CLI", value=False, help="Use full Hermes agent vs direct Ollama")
    
    # Chat history display
    st.markdown("---")
    
    chat_container = st.container()
    
    with chat_container:
        for msg in st.session_state.hermes_history[-10:]:
            if msg['role'] == 'user':
                st.markdown(f"**You:** {msg['content']}")
            else:
                st.markdown(f'<div class="hermes-response"><strong>🤖 Hermes:</strong><br>{msg["content"]}</div>', unsafe_allow_html=True)
    
    # Input
    st.markdown("---")
    user_input = st.text_area("Your message:", height=100, key="chat_input", placeholder="Ask anything... Use /skill <name> to load a skill inline")
    
    col1, col2, col3 = st.columns([1, 1, 3])
    with col1:
        send_btn = st.button("📤 Send", type="primary", use_container_width=True)
    with col2:
        clear_btn = st.button("🗑️ Clear", use_container_width=True)
    
    if clear_btn:
        st.session_state.hermes_history = []
        st.rerun()
    
    if send_btn and user_input:
        st.session_state.hermes_history.append({'role': 'user', 'content': user_input})
        
        with st.spinner("Thinking..."):
            if use_hermes:
                # Use full Hermes CLI
                skill = selected_skill if selected_skill != "None" else None
                result = run_hermes(user_input, skill=skill, model=chat_model)
                response = result['output'] if result['success'] else f"Error: {result['error']}"
            else:
                # Direct Ollama query
                if selected_skill != "None":
                    skill_content = get_skill_content(selected_skill)
                    system_prompt = f"You have loaded the following skill:\n\n{skill_content}\n\nFollow these instructions to help the user."
                else:
                    system_prompt = "You are a helpful AI assistant."
                
                response = query_ollama(user_input, model=chat_model, system=system_prompt)
            
            st.session_state.hermes_history.append({'role': 'assistant', 'content': response})
        
        st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# SKILLS BROWSER
# ─────────────────────────────────────────────────────────────────────────────

elif page == "🛠️ Skills Browser":
    st.markdown("### 🛠️ Skills Browser")
    st.markdown("Browse and use all 83+ Hermes skills")
    
    skills = get_hermes_skills()
    
    # Search and filter
    col1, col2 = st.columns([3, 1])
    with col1:
        search = st.text_input("🔍 Search skills", placeholder="e.g., github, shopify, whisper...")
    with col2:
        categories = sorted(set(s['category'] for s in skills))
        category_filter = st.selectbox("Category", ["All"] + categories)
    
    # Filter skills
    filtered = skills
    if search:
        filtered = [s for s in filtered if search.lower() in s['name'].lower() or search.lower() in s['description'].lower()]
    if category_filter != "All":
        filtered = [s for s in filtered if s['category'] == category_filter]
    
    st.markdown(f"**{len(filtered)} skills found**")
    st.markdown("---")
    
    # Display skills by category
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.markdown("#### Categories")
        current_category = None
        for skill in filtered:
            if skill['category'] != current_category:
                current_category = skill['category']
                st.markdown(f'<div class="category-header">📁 {current_category}</div>', unsafe_allow_html=True)
            
            if st.button(f"📘 {skill['name']}", key=f"skill_{skill['name']}", use_container_width=True):
                st.session_state.current_skill = skill['name']
    
    with col2:
        if st.session_state.current_skill:
            skill_content = get_skill_content(st.session_state.current_skill)
            if skill_content:
                st.markdown(f"#### 📘 {st.session_state.current_skill}")
                
                # Action buttons
                col_a, col_b, col_c = st.columns(3)
                with col_a:
                    if st.button("💬 Use in Chat", use_container_width=True):
                        st.session_state.hermes_history.append({
                            'role': 'system',
                            'content': f"Loaded skill: {st.session_state.current_skill}"
                        })
                with col_b:
                    if st.button("📋 Copy Name", use_container_width=True):
                        st.code(st.session_state.current_skill)
                with col_c:
                    if st.button("🚀 Execute", use_container_width=True):
                        st.session_state.execute_skill = st.session_state.current_skill
                
                # Show skill content
                with st.expander("View Full Skill", expanded=True):
                    st.markdown(skill_content)
                
                # Execute skill
                if hasattr(st.session_state, 'execute_skill') and st.session_state.execute_skill:
                    st.markdown("---")
                    st.markdown("#### Execute Skill")
                    skill_prompt = st.text_area("Task for this skill:", key="skill_exec_prompt")
                    if st.button("🚀 Run", key="skill_exec_btn"):
                        with st.spinner(f"Running {st.session_state.execute_skill}..."):
                            result = run_hermes(skill_prompt, skill=st.session_state.execute_skill)
                            st.markdown(f'<div class="terminal-output">{result["output"]}</div>', unsafe_allow_html=True)
                            if result['error']:
                                st.error(result['error'])
        else:
            st.info("👈 Select a skill from the list to view details")

# ─────────────────────────────────────────────────────────────────────────────
# TASK BOARD
# ─────────────────────────────────────────────────────────────────────────────

elif page == "📋 Task Board":
    st.markdown("### 📋 Task Board")
    
    # Add new task
    with st.expander("➕ Add New Task", expanded=False):
        col1, col2, col3 = st.columns([3, 1, 1])
        with col1:
            new_task = st.text_input("Task description", placeholder="What needs to be done?")
        with col2:
            priority = st.selectbox("Priority", ["🔴 High", "🟡 Medium", "🟢 Low"])
        with col3:
            assign_agent = st.checkbox("🤖 Auto-assign to Hermes")
        
        if st.button("Add Task", type="primary"):
            if new_task:
                tasks = load_tasks()
                task_obj = {
                    "id": len(tasks) + 1,
                    "title": new_task,
                    "priority": priority,
                    "status": "pending",
                    "created": datetime.datetime.now().isoformat(),
                    "notes": "",
                    "agent_assigned": assign_agent
                }
                tasks.append(task_obj)
                save_tasks(tasks)
                
                if assign_agent:
                    st.info("🤖 Task will be processed by Hermes agent")
                
                st.success("Task added!")
                st.rerun()
    
    # AI Task Breakdown
    with st.expander("🧠 AI Task Breakdown", expanded=False):
        complex_task = st.text_area("Describe a complex task to break down:", height=100)
        if st.button("🔍 Analyze & Break Down"):
            with st.spinner("Analyzing with local LLM..."):
                prompt = f"""Break down this task into smaller, actionable subtasks:

Task: {complex_task}

For each subtask, provide:
1. Clear title
2. Priority (High/Medium/Low)
3. Estimated effort
4. Dependencies (if any)

Format as a numbered list."""
                
                result = query_ollama(prompt, model=st.session_state.selected_model)
                st.markdown(result)
                
                if st.button("📥 Import as Tasks"):
                    st.info("Feature: Parse and import subtasks")
    
    # Display tasks in Kanban
    tasks = load_tasks()
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("#### 📥 Pending")
        for task in [t for t in tasks if t.get('status') == 'pending']:
            with st.container():
                st.markdown(f"""
                <div class="task-card">
                    <strong>{task['priority']} {task['title']}</strong><br>
                    <small>Created: {task['created'][:10]}</small>
                    {'<br><small>🤖 Agent assigned</small>' if task.get('agent_assigned') else ''}
                </div>
                """, unsafe_allow_html=True)
                c1, c2, c3 = st.columns(3)
                with c1:
                    if st.button("▶️", key=f"start_{task['id']}", help="Start"):
                        task['status'] = 'in_progress'
                        save_tasks(tasks)
                        st.rerun()
                with c2:
                    if st.button("🤖", key=f"agent_{task['id']}", help="Send to Hermes"):
                        with st.spinner("Hermes working..."):
                            result = run_hermes(f"Complete this task: {task['title']}")
                            task['notes'] = result['output']
                            task['status'] = 'completed'
                            save_tasks(tasks)
                            st.rerun()
                with c3:
                    if st.button("🗑️", key=f"del_{task['id']}", help="Delete"):
                        tasks.remove(task)
                        save_tasks(tasks)
                        st.rerun()
    
    with col2:
        st.markdown("#### 🔄 In Progress")
        for task in [t for t in tasks if t.get('status') == 'in_progress']:
            with st.container():
                st.markdown(f"""
                <div class="task-card" style="border-left-color: #4ecdc4;">
                    <strong>{task['priority']} {task['title']}</strong>
                </div>
                """, unsafe_allow_html=True)
                if st.button("✅ Complete", key=f"complete_{task['id']}"):
                    task['status'] = 'completed'
                    task['completed'] = datetime.datetime.now().isoformat()
                    save_tasks(tasks)
                    st.rerun()
    
    with col3:
        st.markdown("#### ✅ Completed")
        for task in [t for t in tasks if t.get('status') == 'completed'][-5:]:
            st.markdown(f"""
            <div class="task-card" style="border-left-color: #2ecc71; opacity: 0.7;">
                <strong>✓ {task['title']}</strong><br>
                <small>Done: {task.get('completed', '')[:10]}</small>
            </div>
            """, unsafe_allow_html=True)
            if task.get('notes'):
                with st.expander("View Result"):
                    st.text(task['notes'][:500])

# ─────────────────────────────────────────────────────────────────────────────
# CAPTURE
# ─────────────────────────────────────────────────────────────────────────────

elif page == "🎤 Capture":
    st.markdown("### 🎤 Audio & Screen Capture")
    
    tab1, tab2, tab3 = st.tabs(["🎙️ Voice Memo", "📸 Screenshot", "🎬 Screen Recording"])
    
    with tab1:
        st.markdown("#### Record Voice Memo")
        st.markdown("Record → Transcribe with Whisper → Optionally process with Hermes")
        
        col1, col2 = st.columns(2)
        with col1:
            duration = st.slider("Duration (seconds)", 5, 120, 10)
        with col2:
            process_with_hermes = st.checkbox("🤖 Process with Hermes after transcription")
            hermes_action = st.selectbox("Action", ["Summarize", "Extract tasks", "Analyze", "Custom"]) if process_with_hermes else None
        
        if st.button("🎙️ Start Recording", type="primary", use_container_width=True):
            progress = st.progress(0)
            status = st.empty()
            
            status.text(f"🎙️ Recording for {duration} seconds...")
            recording, sr = record_audio(duration)
            progress.progress(33)
            
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"voice_memo_{timestamp}.wav"
            filepath = save_audio(recording, sr, filename)
            status.text("📝 Transcribing with Whisper...")
            progress.progress(66)
            
            transcript = transcribe_audio(filepath)
            progress.progress(100)
            status.text("✅ Complete!")
            
            st.markdown("**Transcript:**")
            st.text_area("", transcript, height=150, key="transcript_display")
            
            if process_with_hermes and transcript:
                with st.spinner(f"Processing: {hermes_action}..."):
                    if hermes_action == "Summarize":
                        prompt = f"Summarize this voice memo:\n\n{transcript}"
                    elif hermes_action == "Extract tasks":
                        prompt = f"Extract actionable tasks from this voice memo:\n\n{transcript}"
                    elif hermes_action == "Analyze":
                        prompt = f"Analyze this voice memo and provide insights:\n\n{transcript}"
                    else:
                        prompt = st.text_input("Custom prompt:", value=f"Process this: {transcript}")
                    
                    result = query_ollama(prompt, model=st.session_state.selected_model)
                    st.markdown("**Hermes Analysis:**")
                    st.markdown(f'<div class="hermes-response">{result}</div>', unsafe_allow_html=True)
        
        # Recent recordings
        st.markdown("---")
        st.markdown("#### Recent Recordings")
        audio_files = sorted(AUDIO_DIR.glob("*.wav"), reverse=True)[:5]
        for af in audio_files:
            col1, col2, col3 = st.columns([2, 1, 1])
            with col1:
                st.audio(str(af))
            with col2:
                txt_file = af.with_suffix('.txt')
                if txt_file.exists():
                    if st.button("📄", key=f"view_{af.name}", help="View transcript"):
                        st.text(txt_file.read_text()[:500])
            with col3:
                if st.button("🤖", key=f"process_{af.name}", help="Process with Hermes"):
                    txt_file = af.with_suffix('.txt')
                    if txt_file.exists():
                        st.session_state.process_audio = txt_file.read_text()
    
    with tab2:
        st.markdown("#### Take Screenshot")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("📸 Full Screen", use_container_width=True):
                filepath = take_screenshot()
                st.success(f"Saved: {filepath}")
                st.image(str(filepath), width=400)
        
        with col2:
            if st.button("✂️ Selection", use_container_width=True):
                st.info("Click and drag to select area...")
                filepath = take_screen_selection()
                if filepath:
                    st.success(f"Saved: {filepath}")
                    st.image(str(filepath), width=400)
        
        # Analyze with vision
        st.markdown("---")
        analyze_screenshot = st.checkbox("🔍 Analyze screenshot with AI")
        if analyze_screenshot:
            st.info("Vision analysis will be performed after capture")
        
        # Recent screenshots
        st.markdown("---")
        st.markdown("#### Recent Screenshots")
        screenshots = sorted(SCREENSHOTS_DIR.glob("*.png"), reverse=True)[:6]
        cols = st.columns(3)
        for i, ss in enumerate(screenshots):
            with cols[i % 3]:
                st.image(str(ss), width=200, caption=ss.name[:20])
    
    with tab3:
        st.markdown("#### Screen Recording")
        st.markdown("Record screen for demos, tutorials, or LLM context")
        
        if st.button("🎬 Start Recording", type="primary"):
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = CAPTURES_DIR / f"recording_{timestamp}.mov"
            subprocess.Popen(['screencapture', '-v', str(filepath)])
            st.warning("🔴 Recording... Press **Cmd+Ctrl+Esc** to stop")
            st.info(f"Saving to: {filepath}")

# ─────────────────────────────────────────────────────────────────────────────
# IDEAS LAB
# ─────────────────────────────────────────────────────────────────────────────

elif page == "💡 Ideas Lab":
    st.markdown("### 💡 Ideas Lab")
    st.markdown("Capture ideas → Break down to concepts → Convert to actionable projects")
    
    tab1, tab2, tab3 = st.tabs(["💡 New Idea", "📚 Ideas Library", "🔬 Idea Analysis"])
    
    with tab1:
        st.markdown("#### Capture New Idea")
        
        idea_title = st.text_input("Idea Title", placeholder="My brilliant idea...")
        idea_desc = st.text_area("Description", placeholder="Describe your idea in detail...", height=150)
        idea_tags = st.text_input("Tags (comma-separated)", placeholder="ai, productivity, automation")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("💾 Save", type="primary", use_container_width=True):
                if idea_title:
                    ideas = load_ideas()
                    ideas.append({
                        "id": len(ideas) + 1,
                        "title": idea_title,
                        "description": idea_desc,
                        "tags": [t.strip() for t in idea_tags.split(",") if t.strip()],
                        "created": datetime.datetime.now().isoformat(),
                        "status": "raw",
                        "breakdown": None,
                        "tasks": []
                    })
                    save_ideas(ideas)
                    st.success("Idea saved!")
                    st.rerun()
        
        with col2:
            if st.button("🧠 Save & Analyze", use_container_width=True):
                if idea_title and idea_desc:
                    with st.spinner("Analyzing with AI..."):
                        prompt = f"""Analyze this idea and provide a comprehensive breakdown:

Title: {idea_title}
Description: {idea_desc}

Provide:
1. **Feasibility Assessment** (Technical, Market, Resource)
2. **Core Components** (What needs to be built)
3. **User Stories** (Who benefits and how)
4. **Technical Architecture** (High-level design)
5. **Implementation Phases** (MVP → Full product)
6. **Risks & Mitigations**
7. **Success Metrics**
8. **Estimated Timeline**"""
                        
                        breakdown = query_ollama(prompt, model=st.session_state.selected_model)
                        
                        ideas = load_ideas()
                        ideas.append({
                            "id": len(ideas) + 1,
                            "title": idea_title,
                            "description": idea_desc,
                            "tags": [t.strip() for t in idea_tags.split(",") if t.strip()],
                            "created": datetime.datetime.now().isoformat(),
                            "status": "analyzed",
                            "breakdown": breakdown,
                            "tasks": []
                        })
                        save_ideas(ideas)
                        
                        st.success("Idea analyzed!")
                        st.markdown("**Analysis:**")
                        st.markdown(f'<div class="hermes-response">{breakdown}</div>', unsafe_allow_html=True)
        
        with col3:
            if st.button("🚀 Full Hermes Analysis", use_container_width=True):
                if idea_title and idea_desc:
                    with st.spinner("Running full Hermes analysis..."):
                        result = run_hermes(f"""Analyze this idea comprehensively:

Title: {idea_title}
Description: {idea_desc}

Use your full capabilities to:
1. Research similar existing solutions
2. Identify technical requirements
3. Create a detailed project plan
4. Suggest relevant skills and tools""")
                        
                        st.markdown(f'<div class="terminal-output">{result["output"]}</div>', unsafe_allow_html=True)
    
    with tab2:
        st.markdown("#### Ideas Library")
        ideas = load_ideas()
        
        # Filter
        status_filter = st.selectbox("Filter by status", ["All", "raw", "analyzed", "in_progress", "completed"])
        
        for idea in reversed(ideas):
            if status_filter != "All" and idea.get('status') != status_filter:
                continue
            
            status_icon = {"raw": "💡", "analyzed": "🧠", "in_progress": "🔄", "completed": "✅"}.get(idea.get('status'), "💡")
            
            with st.expander(f"{status_icon} {idea['title']}", expanded=False):
                st.markdown(f"**Created:** {idea['created'][:10]}")
                st.markdown(f"**Tags:** {', '.join(idea.get('tags', []))}")
                st.markdown(f"**Description:** {idea['description']}")
                
                if idea.get('breakdown'):
                    st.markdown("---")
                    st.markdown("**Analysis:**")
                    st.markdown(idea['breakdown'])
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    if st.button("🧠 Analyze", key=f"analyze_idea_{idea['id']}"):
                        with st.spinner("Analyzing..."):
                            prompt = f"Analyze this idea: {idea['title']}\n\n{idea['description']}"
                            idea['breakdown'] = query_ollama(prompt, model=st.session_state.selected_model)
                            idea['status'] = 'analyzed'
                            save_ideas(ideas)
                            st.rerun()
                with col2:
                    if st.button("📋 → Tasks", key=f"totask_idea_{idea['id']}"):
                        st.info("Converting to tasks...")
                with col3:
                    if st.button("🗑️ Delete", key=f"del_idea_{idea['id']}"):
                        ideas.remove(idea)
                        save_ideas(ideas)
                        st.rerun()
    
    with tab3:
        st.markdown("#### Deep Idea Analysis")
        st.markdown("Use Hermes with specialized skills for comprehensive analysis")
        
        ideas = load_ideas()
        idea_titles = [f"{i['id']}: {i['title']}" for i in ideas]
        selected_idea = st.selectbox("Select idea to analyze", idea_titles) if idea_titles else None
        
        if selected_idea:
            idea_id = int(selected_idea.split(":")[0])
            idea = next((i for i in ideas if i['id'] == idea_id), None)
            
            if idea:
                st.markdown(f"**{idea['title']}**")
                st.markdown(idea['description'])
                
                analysis_type = st.selectbox("Analysis Type", [
                    "Market Research",
                    "Technical Feasibility",
                    "Competitive Analysis",
                    "Business Model Canvas",
                    "User Journey Mapping",
                    "Full Project Plan"
                ])
                
                if st.button("🔬 Run Analysis", type="primary"):
                    with st.spinner(f"Running {analysis_type}..."):
                        prompts = {
                            "Market Research": f"Conduct market research for: {idea['title']}\n{idea['description']}\n\nAnalyze target market, size, trends, and opportunities.",
                            "Technical Feasibility": f"Assess technical feasibility for: {idea['title']}\n{idea['description']}\n\nEvaluate tech stack, complexity, and resource requirements.",
                            "Competitive Analysis": f"Perform competitive analysis for: {idea['title']}\n{idea['description']}\n\nIdentify competitors, their strengths/weaknesses, and differentiation opportunities.",
                            "Business Model Canvas": f"Create a business model canvas for: {idea['title']}\n{idea['description']}\n\nCover all 9 building blocks.",
                            "User Journey Mapping": f"Map user journeys for: {idea['title']}\n{idea['description']}\n\nIdentify touchpoints, pain points, and opportunities.",
                            "Full Project Plan": f"Create a comprehensive project plan for: {idea['title']}\n{idea['description']}\n\nInclude phases, milestones, resources, and timeline."
                        }
                        
                        result = query_ollama(prompts[analysis_type], model=st.session_state.selected_model)
                        st.markdown(f'<div class="hermes-response">{result}</div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# WEBSITE BUILDER
# ─────────────────────────────────────────────────────────────────────────────

elif page == "🌐 Website Builder":
    st.markdown("### 🌐 Website Builder")
    st.markdown("Build websites using Hermes skills and local LLMs")
    
    tab1, tab2, tab3 = st.tabs(["🆕 New Project", "📂 Projects", "🛠️ Tools"])
    
    with tab1:
        site_type = st.selectbox("Project Type", [
            "Shopify Store (Clone/Migrate)",
            "Landing Page",
            "Portfolio",
            "Blog",
            "E-commerce",
            "SaaS Dashboard",
            "Custom Web App"
        ])
        
        if site_type == "Shopify Store (Clone/Migrate)":
            st.markdown("#### Shopify Site Clone")
            st.markdown("Use the `shopify-site-clone` skill to analyze and rebuild")
            
            source_url = st.text_input("Source Store URL", placeholder="https://example.myshopify.com")
            target_store = st.text_input("Target Store (your store)", placeholder="your-store.myshopify.com")
            
            col1, col2 = st.columns(2)
            with col1:
                clone_products = st.checkbox("Clone Products", value=True)
                clone_theme = st.checkbox("Clone Theme/Design", value=True)
            with col2:
                clone_pages = st.checkbox("Clone Pages", value=True)
                clone_blog = st.checkbox("Clone Blog", value=False)
            
            if st.button("🔍 Analyze Source Store", type="primary"):
                with st.spinner("Analyzing with shopify-site-clone skill..."):
                    prompt = f"""Using the shopify-site-clone skill, analyze this Shopify store:
URL: {source_url}

Extract:
1. Product catalog structure
2. Theme design tokens (colors, fonts, spacing)
3. Page structure and navigation
4. Collection organization
{'5. Blog structure' if clone_blog else ''}

Provide a detailed analysis and migration plan."""
                    
                    result = run_hermes(prompt, skill="shopify-site-clone")
                    st.markdown(f'<div class="terminal-output">{result["output"]}</div>', unsafe_allow_html=True)
            
            if st.button("🚀 Start Migration"):
                st.info("This will use Hermes to orchestrate the full migration")
        
        else:
            st.markdown(f"#### {site_type}")
            
            project_name = st.text_input("Project Name")
            project_desc = st.text_area("Requirements", height=150, placeholder="Describe what you want to build...")
            
            col1, col2 = st.columns(2)
            with col1:
                tech_stack = st.multiselect("Tech Stack", [
                    "HTML/CSS/JS",
                    "React",
                    "Vue",
                    "Svelte",
                    "Next.js",
                    "Tailwind CSS",
                    "Bootstrap"
                ])
            with col2:
                features = st.multiselect("Features", [
                    "Responsive Design",
                    "Dark Mode",
                    "Contact Form",
                    "Blog",
                    "Authentication",
                    "Database",
                    "API Integration"
                ])
            
            if st.button("📝 Generate Plan", type="primary"):
                with st.spinner("Generating project plan..."):
                    prompt = f"""Create a detailed website development plan:

Project: {project_name}
Type: {site_type}
Requirements: {project_desc}
Tech Stack: {', '.join(tech_stack)}
Features: {', '.join(features)}

Provide:
1. Project structure
2. Component breakdown
3. Implementation steps
4. File organization
5. Hermes commands to build each part"""
                    
                    result = query_ollama(prompt, model=st.session_state.selected_model)
                    st.markdown(f'<div class="hermes-response">{result}</div>', unsafe_allow_html=True)
            
            if st.button("🚀 Build with Hermes"):
                with st.spinner("Hermes is building your website..."):
                    result = run_hermes(f"Build a {site_type} website: {project_desc}")
                    st.markdown(f'<div class="terminal-output">{result["output"]}</div>', unsafe_allow_html=True)
    
    with tab2:
        st.markdown("#### Projects")
        projects = load_projects()
        
        if not projects:
            st.info("No projects yet. Create one in the 'New Project' tab.")
        
        for project in projects:
            with st.expander(f"🌐 {project['name']}", expanded=False):
                st.markdown(f"**Type:** {project['type']}")
                st.markdown(f"**Created:** {project['created'][:10]}")
                st.markdown(f"**Status:** {project.get('status', 'planning')}")
    
    with tab3:
        st.markdown("#### Website Building Tools")
        
        st.markdown("**Available Skills:**")
        web_skills = ["shopify-site-clone", "shopify-admin-updates", "popular-web-designs", "excalidraw"]
        for skill in web_skills:
            if st.button(f"📘 {skill}", key=f"web_skill_{skill}", use_container_width=True):
                st.session_state.current_skill = skill
        
        st.markdown("---")
        st.markdown("**Quick Commands:**")
        st.code("""
# Clone a Shopify site
hermes "Use shopify-site-clone to analyze https://example.com"

# Generate landing page
hermes "Create a landing page for [product] using popular-web-designs"

# Create wireframe
hermes "Create an excalidraw wireframe for [description]"
        """)

# ─────────────────────────────────────────────────────────────────────────────
# AGENT SPAWNER
# ─────────────────────────────────────────────────────────────────────────────

elif page == "🤖 Agent Spawner":
    st.markdown("### 🤖 Agent Spawner — Commandeer")
    st.markdown("Pick one or more agents, equip them with skills, dispatch a shared goal in parallel.")

    tab1, tab2, tab3 = st.tabs(["🎯 Commandeer", "📊 Active Agents", "📜 Agent Templates"])

    with tab1:
        cc_agents = get_claudeclaw_agents()
        all_skills = get_all_skills()

        st.markdown("#### 1. Select agents to commandeer")
        if cc_agents:
            agent_cols = st.columns(min(len(cc_agents), 5))
            selected_agents = []
            for i, a in enumerate(cc_agents):
                with agent_cols[i % len(agent_cols)]:
                    if st.checkbox(f"**{a['name']}**", key=f"agent_pick_{a['name']}",
                                   help=a['description']):
                        selected_agents.append(a)
        else:
            st.info("No ClaudeClaw agents found in Repo/agents/")
            selected_agents = []

        st.markdown("#### 2. Equip with skills (optional)")
        skill_labels = [f"[{s['source']}] {s['category']}/{s['name']}" for s in all_skills]
        skill_lookup = dict(zip(skill_labels, all_skills))
        picked_labels = st.multiselect(
            f"Skills ({len(all_skills)} available across Hermes + ClaudeClaw)",
            skill_labels,
            help="Attached skills get prepended to every dispatched agent's prompt.",
        )
        selected_skills = [skill_lookup[label] for label in picked_labels]

        st.markdown("#### 3. Shared goal")
        shared_goal = st.text_area(
            "Goal / prompt",
            height=120,
            placeholder="What should all selected agents accomplish?",
            key="commandeer_goal",
        )
        shared_context = st.text_area(
            "Context (optional)",
            height=80,
            placeholder="Background information every agent should have...",
            key="commandeer_context",
        )

        col_a, col_b = st.columns(2)
        with col_a:
            dispatch_model = st.selectbox("Model", all_models, index=0, key="commandeer_model")
        with col_b:
            dispatch_timeout = st.slider("Per-agent timeout (sec)", 60, 1800, 600, key="commandeer_timeout")

        dispatch_disabled = not shared_goal.strip() or (not selected_agents and not selected_skills)
        if st.button("🚀 Dispatch", type="primary", disabled=dispatch_disabled):
            # Build per-target dispatch plan. If no agents picked, fall back to a single bare-Hermes
            # run with the attached skills.
            targets = list(selected_agents) if selected_agents else [{
                'name': 'hermes',
                'description': 'Bare Hermes runner (no agent persona)',
                'path': None,
                'source': 'hermes-bare',
            }]

            skill_preamble = ""
            if selected_skills:
                skill_preamble = "SKILLS EQUIPPED:\n"
                for sk in selected_skills:
                    skill_preamble += f"  - [{sk['source']}] {sk['category']}/{sk['name']}: {sk['description']}\n"
                skill_preamble += "\n"

            def build_prompt(agent):
                agent_prompt = ""
                if agent.get('path'):
                    try:
                        agent_prompt = Path(agent['path']).read_text() + "\n\n"
                    except Exception:
                        pass
                return (
                    f"{agent_prompt}"
                    f"{skill_preamble}"
                    f"GOAL: {shared_goal}\n\n"
                    f"CONTEXT: {shared_context or '(none)'}\n\n"
                    f"Work toward the goal. Report progress and final results."
                )

            # Inject the *first* selected skill as Hermes's --skill flag (Hermes only supports one).
            # Extra skills are already described in the preamble.
            primary_skill = selected_skills[0]['name'] if selected_skills else None

            def dispatch_one(agent):
                agent_id = f"{agent['name']}_{datetime.datetime.now().strftime('%H%M%S_%f')}"
                prompt = build_prompt(agent)
                result = run_hermes(prompt, skill=primary_skill, model=dispatch_model, timeout=dispatch_timeout)
                return agent_id, {
                    "id": agent_id,
                    "agent": agent['name'],
                    "goal": shared_goal,
                    "skills": [s['name'] for s in selected_skills],
                    "status": "completed" if result['success'] else "failed",
                    "output": result['output'],
                    "error": result['error'],
                    "created": datetime.datetime.now().isoformat(),
                }

            st.markdown(f"**Dispatching to {len(targets)} target(s) in parallel…**")
            progress_cols = st.columns(len(targets))
            placeholders = {a['name']: progress_cols[i].empty() for i, a in enumerate(targets)}
            for a in targets:
                placeholders[a['name']].info(f"⏳ {a['name']}: running…")

            with ThreadPoolExecutor(max_workers=min(len(targets), 6)) as pool:
                futures = {pool.submit(dispatch_one, a): a for a in targets}
                for fut in futures:
                    agent = futures[fut]
                    try:
                        agent_id, record = fut.result()
                    except Exception as e:
                        placeholders[agent['name']].error(f"❌ {agent['name']}: {e}")
                        continue
                    st.session_state.active_agents[agent_id] = record
                    icon = "✅" if record['status'] == 'completed' else "⚠️"
                    placeholders[agent['name']].success(f"{icon} {agent['name']} · {record['status']}")

            st.success("Dispatch complete — expand entries under **Active Agents** for per-target output.")
    
    with tab2:
        st.markdown("#### Active & Recent Agents")
        
        if not st.session_state.active_agents:
            st.info("No agents spawned yet.")
        
        for agent_id, agent in st.session_state.active_agents.items():
            status_class = {
                "running": "agent-running",
                "completed": "agent-idle",
                "failed": "agent-error"
            }.get(agent['status'], "agent-idle")
            
            st.markdown(f"""
            <div class="agent-status {status_class}">
                <strong>{agent_id}</strong><br>
                <small>Goal: {agent['goal'][:50]}...</small><br>
                <small>Status: {agent['status']}</small>
            </div>
            """, unsafe_allow_html=True)
            
            with st.expander("View Output"):
                st.text(agent.get('output', 'No output')[:2000])
                if agent.get('error'):
                    st.error(agent['error'])
    
    with tab3:
        st.markdown("#### Agent Templates")
        
        templates = [
            {
                "name": "Code Reviewer",
                "goal": "Review the code in [path] for bugs, security issues, and improvements",
                "toolsets": ["terminal", "file"],
                "icon": "🔍"
            },
            {
                "name": "Research Agent",
                "goal": "Research [topic] and compile a comprehensive report",
                "toolsets": ["web", "file"],
                "icon": "📚"
            },
            {
                "name": "Bug Fixer",
                "goal": "Find and fix bugs related to [issue] in the codebase",
                "toolsets": ["terminal", "file"],
                "icon": "🐛"
            },
            {
                "name": "Content Creator",
                "goal": "Create [type] content about [topic]",
                "toolsets": ["web", "file"],
                "icon": "✍️"
            },
            {
                "name": "Data Analyst",
                "goal": "Analyze [data source] and provide insights",
                "toolsets": ["terminal", "file", "web"],
                "icon": "📊"
            },
            {
                "name": "DevOps Agent",
                "goal": "Set up [infrastructure] and configure deployment",
                "toolsets": ["terminal", "file"],
                "icon": "🔧"
            }
        ]
        
        cols = st.columns(2)
        for i, template in enumerate(templates):
            with cols[i % 2]:
                if st.button(f"{template['icon']} {template['name']}", key=f"template_{i}", use_container_width=True):
                    st.session_state.agent_template = template
                    st.rerun()
        
        if hasattr(st.session_state, 'agent_template'):
            t = st.session_state.agent_template
            st.markdown(f"#### {t['icon']} {t['name']} Template")
            st.text_input("Goal", value=t['goal'], key="template_goal")
            st.multiselect("Toolsets", t['toolsets'], default=t['toolsets'], key="template_toolsets")

# ─────────────────────────────────────────────────────────────────────────────
# CRON JOBS
# ─────────────────────────────────────────────────────────────────────────────

elif page == "⏰ Cron Jobs":
    st.markdown("### ⏰ Scheduled Jobs")
    st.markdown("Schedule recurring Hermes tasks")
    
    tab1, tab2 = st.tabs(["📅 Jobs", "➕ New Job"])
    
    with tab1:
        st.markdown("#### Active Cron Jobs")
        
        # Try to get cron jobs
        cron_file = HERMES_DIR / "cron" / "jobs.json"
        jobs = []
        if cron_file.exists():
            try:
                jobs = json.loads(cron_file.read_text())
            except:
                pass
        
        if not jobs:
            st.info("No scheduled jobs. Create one in the 'New Job' tab.")
        
        for job in jobs:
            st.markdown(f"""
            <div class="cron-job">
                <strong>{job.get('name', 'Unnamed Job')}</strong><br>
                <small>Schedule: {job.get('schedule', 'N/A')}</small><br>
                <small>Status: {job.get('status', 'active')}</small>
            </div>
            """, unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("▶️ Run Now", key=f"run_job_{job.get('id', 0)}"):
                    st.info("Running job...")
            with col2:
                if st.button("⏸️ Pause", key=f"pause_job_{job.get('id', 0)}"):
                    st.info("Job paused")
            with col3:
                if st.button("🗑️ Delete", key=f"del_job_{job.get('id', 0)}"):
                    st.info("Job deleted")
    
    with tab2:
        st.markdown("#### Create New Scheduled Job")
        
        job_name = st.text_input("Job Name", placeholder="Daily Report")
        job_prompt = st.text_area("Job Prompt", height=100, placeholder="What should this job do?")
        
        col1, col2 = st.columns(2)
        with col1:
            schedule_type = st.selectbox("Schedule Type", [
                "Every X minutes",
                "Every X hours",
                "Daily at specific time",
                "Weekly",
                "Custom cron"
            ])
        with col2:
            if schedule_type == "Every X minutes":
                interval = st.number_input("Minutes", min_value=5, max_value=60, value=30)
                schedule = f"{interval}m"
            elif schedule_type == "Every X hours":
                interval = st.number_input("Hours", min_value=1, max_value=24, value=1)
                schedule = f"{interval}h"
            elif schedule_type == "Daily at specific time":
                time_val = st.time_input("Time")
                schedule = f"0 {time_val.hour} * * *"
            elif schedule_type == "Weekly":
                day = st.selectbox("Day", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
                day_num = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].index(day)
                schedule = f"0 9 * * {day_num}"
            else:
                schedule = st.text_input("Cron Expression", placeholder="0 9 * * *")
        
        deliver_to = st.selectbox("Deliver Results To", ["local", "telegram", "discord", "email"])
        
        if st.button("📅 Create Job", type="primary"):
            st.info(f"Creating job with schedule: {schedule}")
            st.code(f'hermes /cron create "{schedule}" {job_prompt}')

# ─────────────────────────────────────────────────────────────────────────────
# MEMORY
# ─────────────────────────────────────────────────────────────────────────────

elif page == "🧠 Memory":
    st.markdown("### 🧠 Hermes Memory")
    st.markdown("View and manage agent memory and user profile")
    
    tab1, tab2, tab3 = st.tabs(["📝 Memory", "👤 User Profile", "🔍 Session Search"])
    
    with tab1:
        st.markdown("#### Agent Memory")
        st.markdown("Persistent facts and learned information")
        
        memory_content = get_hermes_memory()
        
        if memory_content:
            st.text_area("Memory Contents", memory_content, height=300)
        else:
            st.info("No memory content found.")
        
        st.markdown("---")
        st.markdown("#### Add to Memory")
        new_memory = st.text_area("New memory entry:", height=100)
        if st.button("💾 Save to Memory"):
            with st.spinner("Adding to memory..."):
                result = run_hermes(f"Remember this: {new_memory}")
                st.success("Memory updated!")
    
    with tab2:
        st.markdown("#### User Profile")
        st.markdown("Information about you that Hermes remembers")
        
        profile_content = get_user_profile()
        
        if profile_content:
            st.text_area("Profile Contents", profile_content, height=300)
        else:
            st.info("No user profile found.")
        
        st.markdown("---")
        st.markdown("#### Update Profile")
        new_profile_info = st.text_area("Add profile information:", height=100)
        if st.button("👤 Update Profile"):
            with st.spinner("Updating profile..."):
                result = run_hermes(f"Update my profile with: {new_profile_info}")
                st.success("Profile updated!")
    
    with tab3:
        st.markdown("#### Search Past Sessions")
        
        search_query = st.text_input("Search query", placeholder="what did we work on last week?")
        
        if st.button("🔍 Search", type="primary"):
            with st.spinner("Searching sessions..."):
                result = run_hermes(f"Search my past sessions for: {search_query}")
                st.markdown(f'<div class="hermes-response">{result["output"]}</div>', unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# SESSIONS
# ─────────────────────────────────────────────────────────────────────────────

elif page == "📊 Sessions":
    st.markdown("### 📊 Session History")
    
    st.markdown("#### Recent Sessions")
    
    # List session files
    sessions_db = HERMES_DIR / "sessions.db"
    
    if sessions_db.exists():
        st.success(f"Sessions database found: {sessions_db}")
        st.info("Use `/sessions` in Hermes CLI to browse sessions")
    else:
        st.warning("No sessions database found")
    
    st.markdown("---")
    st.markdown("#### Session Actions")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("📥 Export Current Session", use_container_width=True):
            st.info("Export functionality")
        if st.button("🔄 Resume Last Session", use_container_width=True):
            st.code("hermes /resume")
    with col2:
        if st.button("🗑️ Clear Session", use_container_width=True):
            st.code("hermes /reset")
        if st.button("📊 Session Stats", use_container_width=True):
            st.info("Stats functionality")

# ─────────────────────────────────────────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

elif page == "⚙️ Settings":
    st.markdown("### ⚙️ Settings")
    
    tab1, tab2, tab3, tab4 = st.tabs(["🤖 Models", "🛠️ Hermes Config", "📁 Storage", "ℹ️ About"])
    
    with tab1:
        st.markdown("#### Model Configuration")
        
        config = get_hermes_config()
        
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Current Default Model:**")
            st.code(config.get('model', {}).get('default', 'N/A'))
            
            st.markdown("**Provider:**")
            st.code(config.get('model', {}).get('provider', 'N/A'))
        
        with col2:
            st.markdown("**Fallback Chain:**")
            fallbacks = config.get('fallback_providers', [])
            for fb in fallbacks:
                st.markdown(f"  → {fb.get('provider')}/{fb.get('model')}")
        
        st.markdown("---")
        st.markdown("#### Local Ollama Models")
        
        models = get_ollama_models()
        for m in models:
            col1, col2 = st.columns([3, 1])
            with col1:
                st.markdown(f"• `{m}`")
            with col2:
                if st.button("Set Default", key=f"setdef_{m}"):
                    st.code(f"hermes /model ollama/{m}")
        
        st.markdown("---")
        st.markdown("#### Quick Model Switch")
        
        presets = {
            "🏠 Local Fast (gemma4:31b)": "ollama/gemma4:31b",
            "🏠 Local Power (llama3.3)": "ollama/llama3.3:latest",
            "🏠 Local Max (gpt-oss:120b)": "ollama/gpt-oss:120b",
            "☁️ Claude Opus": "anthropic/claude-opus-4-5-20251101",
            "☁️ Claude Sonnet": "anthropic/claude-sonnet-4",
            "☁️ Gemini Pro": "google/gemini-2.5-pro"
        }
        
        for name, model in presets.items():
            if st.button(name, key=f"preset_{model}", use_container_width=True):
                st.code(f"hermes /model {model}")
    
    with tab2:
        st.markdown("#### Hermes Configuration")
        
        config = get_hermes_config()
        
        with st.expander("View Full Config", expanded=False):
            st.code(yaml.dump(config, default_flow_style=False))
        
        st.markdown("---")
        st.markdown("#### Key Settings")
        
        # Smart routing
        smart_routing = config.get('smart_model_routing', {})
        st.checkbox("Smart Model Routing", value=smart_routing.get('enabled', False), key="smart_routing")
        
        # Compression
        compression = config.get('compression', {})
        st.checkbox("Context Compression", value=compression.get('enabled', True), key="compression")
        
        # STT
        stt = config.get('stt', {})
        st.markdown(f"**STT Provider:** {stt.get('provider', 'N/A')}")
        st.markdown(f"**STT Model:** {stt.get('local', {}).get('model', 'N/A')}")
    
    with tab3:
        st.markdown("#### Storage Locations")
        
        paths = {
            "Command Center": BASE_DIR,
            "Hermes Config": HERMES_DIR,
            "Tasks": TASKS_DIR,
            "Ideas": IDEAS_DIR,
            "Audio": AUDIO_DIR,
            "Screenshots": SCREENSHOTS_DIR,
            "Captures": CAPTURES_DIR,
            "Exports": EXPORTS_DIR
        }
        
        for name, path in paths.items():
            files = list(path.glob("*")) if path.exists() else []
            st.markdown(f"**{name}:** `{path}` ({len(files)} items)")
        
        st.markdown("---")
        st.markdown("#### Storage Actions")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("📤 Export All Data", use_container_width=True):
                export_data = {
                    "tasks": load_tasks(),
                    "ideas": load_ideas(),
                    "projects": load_projects(),
                    "exported": datetime.datetime.now().isoformat()
                }
                export_file = EXPORTS_DIR / f"full_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                export_file.write_text(json.dumps(export_data, indent=2))
                st.success(f"Exported to: {export_file}")
        with col2:
            if st.button("🗑️ Clear Completed Tasks", use_container_width=True):
                tasks = [t for t in load_tasks() if t.get('status') != 'completed']
                save_tasks(tasks)
                st.success("Cleared!")
    
    with tab4:
        st.markdown("#### About Command Center")
        
        st.markdown("""
        **Command Center v2.0** - Full Hermes Integration
        
        A local-first AI workspace that combines:
        - 🎯 Task & Project Management
        - 🎤 Audio/Screen Capture with AI Transcription
        - 💡 Idea Incubation & Analysis
        - 🤖 Autonomous Agent Spawning
        - 🛠️ 83+ Hermes Skills
        - ⏰ Scheduled Automation
        - 🧠 Persistent Memory
        
        **Cost Optimization:**
        - Default: Local Ollama models (FREE)
        - Fallback: Google Gemini → Claude API
        - Smart routing for simple queries
        
        **Tech Stack:**
        - Streamlit (GUI)
        - Ollama (Local LLMs)
        - Whisper (Speech-to-Text)
        - Hermes Agent (AI Orchestration)
        """)

# ══════════════════════════════════════════════════════════════════════════════
# FOOTER
# ══════════════════════════════════════════════════════════════════════════════

st.markdown("---")
st.markdown(
    "<center><small>Command Center v2.0 | Full Hermes Integration | Local-First AI Workspace</small></center>",
    unsafe_allow_html=True
)
