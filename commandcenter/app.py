#!/usr/bin/env python3
"""
Command Center v2.0 - Full Hermes Integration
Local-First AI Workspace with complete agent capabilities.
"""

import streamlit as st
import subprocess
import json
import os
import sys
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

# Cloud models for heavier workloads (Task Board, Ideas Lab, Website Builder).
# Local 31B models on this box run CPU-only and take ~10min for a short reply,
# so route agentic/structured-analysis work to Claude by default. Override via
# env vars if you want a different target.
CLOUD_TASK_MODEL = os.environ.get("CC_CLOUD_TASK_MODEL", "anthropic/claude-sonnet-4.6")
CLOUD_FAST_MODEL = os.environ.get("CC_CLOUD_FAST_MODEL", "anthropic/claude-haiku-4.5")

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

# Adaptive theme — works in both Streamlit dark and light modes.
# We declare CSS custom properties at :root for dark (the config default),
# then flip them via @media (prefers-color-scheme: light) AND via
# Streamlit's own theme attribute when the user toggles in-app.
# Gold accent stays constant across both modes.
st.markdown("""
<style>
    :root {
        /* Dark defaults */
        --cc-surface-0: #0f0f1a;
        --cc-surface-1: #1a1a2e;
        --cc-surface-2: #16213e;
        --cc-text:      #f3f4f6;
        --cc-text-mute: #9ca3af;
        --cc-border:    rgba(212,160,23,0.30);
        --cc-card-bg:   rgba(255,255,255,0.05);
        --cc-card-bg2:  rgba(255,255,255,0.08);
        --cc-input-bg:  #1a1a2e;
        --cc-code-bg:   #0d1117;
        --cc-code-fg:   #c9d1d9;

        /* Brand accent — same in both modes */
        --cc-gold:      #d4a017;
        --cc-gold-soft: rgba(212,160,23,0.16);
        --cc-amber:     #c2410c;

        /* Status hues — same in both modes */
        --cc-success:   #16a34a;
        --cc-warn:      #d97706;
        --cc-error:     #dc2626;
        --cc-info:      #2563eb;
    }

    /* Light-mode overrides — applied when OS is light *and* Streamlit
       hasn't been forced to dark by app config. Streamlit also sets
       data-theme on the body, so we cover both signals. */
    @media (prefers-color-scheme: light) {
        :root {
            --cc-surface-0: #fafaf7;
            --cc-surface-1: #f1f1ea;
            --cc-surface-2: #e8e6dd;
            --cc-text:      #18181b;
            --cc-text-mute: #57534e;
            --cc-border:    rgba(180,130,10,0.40);
            --cc-card-bg:   rgba(0,0,0,0.04);
            --cc-card-bg2:  rgba(0,0,0,0.07);
            --cc-input-bg:  #ffffff;
            --cc-code-bg:   #f5f5f4;
            --cc-code-fg:   #1c1917;
            --cc-gold:      #b4820a;
            --cc-gold-soft: rgba(180,130,10,0.14);
        }
    }
    /* If Streamlit explicitly renders the light theme, force light tokens
       regardless of OS preference. Streamlit puts data-theme on body. */
    body[data-theme="light"] {
        --cc-surface-0: #fafaf7;
        --cc-surface-1: #f1f1ea;
        --cc-surface-2: #e8e6dd;
        --cc-text:      #18181b;
        --cc-text-mute: #57534e;
        --cc-border:    rgba(180,130,10,0.40);
        --cc-card-bg:   rgba(0,0,0,0.04);
        --cc-card-bg2:  rgba(0,0,0,0.07);
        --cc-input-bg:  #ffffff;
        --cc-code-bg:   #f5f5f4;
        --cc-code-fg:   #1c1917;
        --cc-gold:      #b4820a;
        --cc-gold-soft: rgba(180,130,10,0.14);
    }

    /* ── Root surface ──────────────────────────────────────────────── */
    .stApp {
        background: linear-gradient(135deg,
            var(--cc-surface-0) 0%,
            var(--cc-surface-1) 50%,
            var(--cc-surface-2) 100%) !important;
        color: var(--cc-text) !important;
    }

    /* ── Streamlit widgets ─────────────────────────────────────────── */
    [data-testid="stMetricValue"] { color: var(--cc-gold) !important; font-weight: 700; }
    [data-testid="stMetricLabel"] { color: var(--cc-text) !important; }
    [data-testid="stMetricDelta"] { color: var(--cc-text-mute) !important; }

    .stTextInput input, .stTextArea textarea,
    .stSelectbox div[data-baseweb="select"] > div,
    .stMultiSelect div[data-baseweb="select"] > div,
    .stNumberInput input, .stDateInput input {
        background-color: var(--cc-input-bg) !important;
        color: var(--cc-text) !important;
        border: 1px solid var(--cc-border) !important;
    }
    .stTextInput input::placeholder,
    .stTextArea textarea::placeholder { color: var(--cc-text-mute) !important; }

    .stTextInput label, .stTextArea label, .stSelectbox label,
    .stMultiSelect label, .stNumberInput label, .stSlider label,
    .stCheckbox label, .stRadio label, .stDateInput label,
    .stFileUploader label {
        color: var(--cc-text) !important; font-weight: 500;
    }

    /* Buttons — secondary (default) */
    .stButton > button, .stDownloadButton > button {
        background: var(--cc-gold-soft) !important;
        color: var(--cc-gold) !important;
        border: 1px solid var(--cc-border) !important;
        font-weight: 600;
    }
    .stButton > button:hover, .stDownloadButton > button:hover {
        background: var(--cc-gold) !important;
        color: var(--cc-surface-0) !important;
        border-color: var(--cc-gold) !important;
    }
    /* Buttons — primary */
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, var(--cc-gold), var(--cc-amber)) !important;
        color: #ffffff !important;
        border: 1px solid var(--cc-gold) !important;
    }
    .stButton > button[kind="primary"]:hover { filter: brightness(1.1); }
    /* Disabled state must stay legible too */
    .stButton > button:disabled {
        opacity: 0.55;
        color: var(--cc-text-mute) !important;
    }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { gap: 4px; }
    .stTabs [data-baseweb="tab"] {
        color: var(--cc-text-mute) !important;
        background: var(--cc-card-bg);
        border-radius: 8px 8px 0 0;
    }
    .stTabs [aria-selected="true"] {
        color: var(--cc-gold) !important;
        background: var(--cc-gold-soft) !important;
        border-bottom: 2px solid var(--cc-gold);
    }

    /* Expanders */
    .streamlit-expanderHeader, details summary { color: var(--cc-text) !important; }
    .streamlit-expander { border-color: var(--cc-border) !important; }

    /* Captions / helper text */
    .stCaption, small, [data-testid="stCaptionContainer"] {
        color: var(--cc-text-mute) !important;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, var(--cc-surface-0), var(--cc-surface-2)) !important;
        border-right: 1px solid var(--cc-border);
    }
    [data-testid="stSidebar"], [data-testid="stSidebar"] p,
    [data-testid="stSidebar"] li, [data-testid="stSidebar"] span,
    [data-testid="stSidebar"] label { color: var(--cc-text) !important; }
    [data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3 { color: var(--cc-gold) !important; }

    /* Alerts — keep Streamlit's tinted backgrounds; ensure text contrasts.
       The previous version forced text to near-black, which became invisible
       on Streamlit's dark-mode tinted alert backgrounds. We use currentColor
       and let each alert variant pick a strong, accessible foreground. */
    [data-testid="stAlert"] {
        border: 1px solid var(--cc-border) !important;
    }
    [data-testid="stAlert"] p,
    [data-testid="stAlert"] div,
    [data-testid="stAlert"] span {
        color: var(--cc-text) !important;
        font-weight: 500;
    }

    /* Body markdown — !important so Streamlit's defaults can't undo us */
    .block-container p, .block-container li, .block-container span,
    .block-container label, .block-container td, .block-container th {
        color: var(--cc-text) !important;
    }
    .block-container h1, .block-container h2, .block-container h3,
    .block-container h4 { color: var(--cc-gold) !important; }
    .block-container a { color: var(--cc-gold) !important; }

    /* Code blocks */
    .stCodeBlock, pre, code {
        background: var(--cc-code-bg) !important;
        color: var(--cc-code-fg) !important;
        border: 1px solid var(--cc-border) !important;
    }

    /* Dataframes */
    [data-testid="stDataFrame"] {
        background: var(--cc-card-bg) !important;
        border: 1px solid var(--cc-border) !important;
    }

    /* ── Custom classes ────────────────────────────────────────────── */
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        background: linear-gradient(90deg, var(--cc-gold), var(--cc-amber), var(--cc-gold));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        padding: 1rem;
    }
    .task-card {
        background: var(--cc-card-bg);
        border-radius: 12px;
        padding: 1rem;
        margin: 0.5rem 0;
        border-left: 4px solid var(--cc-gold);
        color: var(--cc-text);
    }
    .skill-card {
        background: var(--cc-gold-soft);
        border-radius: 10px;
        padding: 0.75rem;
        margin: 0.25rem 0;
        border: 1px solid var(--cc-border);
        color: var(--cc-text);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .skill-card:hover {
        border-color: var(--cc-gold);
        transform: translateX(4px);
    }
    .model-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: var(--cc-gold-soft);
        border-radius: 15px;
        font-size: 0.8rem;
        color: var(--cc-gold);
        border: 1px solid var(--cc-border);
    }
    .agent-status {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        color: var(--cc-text);
    }
    .agent-running { background: rgba(22,163,74,0.18);  border-left: 3px solid var(--cc-success); }
    .agent-idle    { background: var(--cc-gold-soft);   border-left: 3px solid var(--cc-gold); }
    .agent-error   { background: rgba(220,38,38,0.18);  border-left: 3px solid var(--cc-error); }
    .terminal-output {
        background: var(--cc-code-bg);
        color: var(--cc-code-fg);
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.85rem;
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        white-space: pre-wrap;
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid var(--cc-border);
    }
    .hermes-response {
        background: var(--cc-card-bg2);
        border: 1px solid var(--cc-border);
        border-radius: 12px;
        padding: 1.25rem;
        margin: 1rem 0;
        color: var(--cc-text);
    }
    .category-header {
        color: var(--cc-gold);
        font-weight: bold;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--cc-border);
        margin-bottom: 0.5rem;
    }
    .cron-job {
        background: var(--cc-card-bg);
        border-radius: 8px;
        padding: 0.75rem;
        margin: 0.5rem 0;
        border-left: 3px solid var(--cc-info);
        color: var(--cc-text);
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
    st.session_state.selected_model = "llama3.2:latest"

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
    cmd = ['hermes', 'chat', '-Q']

    if model:
        cmd.extend(['-m', model])

    if skill:
        prompt = f"/skill {skill}\n{prompt}"

    cmd.extend(['-q', prompt])
    
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
    cmd = ['hermes', 'chat', '-Q']

    if model:
        cmd.extend(['-m', model])

    if skill:
        prompt = f"/skill {skill}\n{prompt}"

    cmd.extend(['-q', prompt])
    
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

def ask_cloud(prompt, skill=None, model=None, timeout=300):
    """Run *prompt* via Hermes routed to a cloud model and return the response
    text. Use this for heavy/agentic workloads (Task Board, Ideas Lab,
    Website Builder) where local 31B+ models on CPU would time out. Returns a
    string — on failure, a "❌ …" message rather than raising."""
    result = run_hermes(
        prompt,
        skill=skill,
        model=model or CLOUD_TASK_MODEL,
        timeout=timeout,
    )
    if result.get('success'):
        return (result.get('output') or '').strip()
    err = (result.get('error') or '').strip() or 'Hermes call failed'
    return f"❌ {err}"

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

CRON_FILE = HERMES_DIR / "cron" / "jobs.json"


def get_cron_jobs():
    """Get Hermes cron jobs"""
    if CRON_FILE.exists():
        try:
            return json.loads(CRON_FILE.read_text())
        except Exception:
            return []
    return []


def save_cron_jobs(jobs):
    """Persist cron jobs to ~/.hermes/cron/jobs.json."""
    CRON_FILE.parent.mkdir(parents=True, exist_ok=True)
    CRON_FILE.write_text(json.dumps(jobs, indent=2))


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
    return ['llama3.2:latest', 'gemma3:latest', 'gemma4:31b']

def query_ollama(prompt, model="llama3.2:latest", system="You are a helpful assistant.", stream=False):
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
            timeout=300
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

_EXCLUDE_DEVICE_HINTS = ("iphone", "ipad", "airpods", "microsoft teams", "zoom")


def _input_device_candidates(devices, input_devices):
    """Yield device indices to try, in priority order.

    1. CC_AUDIO_INPUT_DEVICE env override (explicit — trust the user)
    2. OS default input, IF its name doesn't look flaky on macOS
    3. Any remaining input devices whose names don't look flaky
    4. Everything else as a last-ditch attempt

    Flaky = devices like "iPhone Microphone" (Continuity) that enumerate
    and are often the OS default but fail to open with PortAudio
    paInternalError when the phone isn't actively streaming.
    """
    seen: set[int] = set()

    def _yield(idx):
        if idx is not None and idx in input_devices and idx not in seen:
            seen.add(idx)
            return [idx]
        return []

    pref = os.environ.get("CC_AUDIO_INPUT_DEVICE", "").strip()
    if pref:
        if pref.isdigit():
            yield from _yield(int(pref))
        else:
            for i in input_devices:
                if pref.lower() in devices[i]['name'].lower():
                    yield from _yield(i)
                    break

    default_idx: int | None = None
    try:
        default = sd.query_devices(kind='input')
        if isinstance(default, dict):
            default_idx = default.get('index')
    except Exception:
        pass

    def _is_flaky(idx):
        name = devices[idx]['name'].lower()
        return any(h in name for h in _EXCLUDE_DEVICE_HINTS)

    # OS default — but only if it looks reliable
    if default_idx is not None and not _is_flaky(default_idx):
        yield from _yield(default_idx)

    # Preferred: reliable-looking devices
    for i in input_devices:
        if not _is_flaky(i):
            yield from _yield(i)

    # Last resort: include flaky ones too (covers the edge case where the
    # only available mic happens to match a blocked hint)
    for i in input_devices:
        yield from _yield(i)


def record_audio(duration=10, sample_rate=16000):
    """Record audio from microphone with robust device handling.

    Probes candidates in priority order and uses the first one that
    successfully opens an input stream. Returns (recording, sample_rate)
    or (None, None) on failure. The failure path lists every device it
    tried and why so you can diagnose without guessing.
    """
    import streamlit as st
    tried: list[tuple[str, str]] = []  # (device name, error)
    devices = []
    input_devices: list[int] = []
    try:
        devices = sd.query_devices()
        input_devices = [i for i, d in enumerate(devices) if d['max_input_channels'] > 0]
        if not input_devices:
            st.error("No audio input device detected on this system.")
            return None, None

        for candidate in _input_device_candidates(devices, input_devices):
            name = devices[candidate]['name']
            try:
                sd.check_input_settings(
                    device=candidate,
                    samplerate=sample_rate,
                    channels=1,
                    dtype='float32',
                )
                recording = sd.rec(
                    int(duration * sample_rate),
                    samplerate=sample_rate,
                    channels=1,
                    dtype='float32',
                    device=candidate,
                )
                sd.wait()
                if recording is None or getattr(recording, "size", 0) == 0:
                    tried.append((name, "returned no samples"))
                    continue
                return recording, sample_rate
            except Exception as probe_err:
                tried.append((name, str(probe_err)))
                continue

        # Nothing worked — report everything we tried, and surface the
        # macOS-specific diagnosis when every candidate fails the same way
        # (paInternalError on every device = no mic access for this process,
        # typically because Streamlit was launched by launchd without a
        # responsible GUI app attached for TCC).
        available = ", ".join(f"[{i}] {devices[i]['name']}" for i in input_devices)
        lines = "\n".join(f"  • {n}: {err}" for n, err in tried) or "  (nothing attempted)"
        all_internal = tried and all("PaErrorCode -9986" in e or "Internal PortAudio" in e for _, e in tried)
        macos_hint = ""
        if sys.platform == "darwin" and all_internal:
            ppid = os.getppid()
            try:
                parent_cmd = subprocess.run(
                    ["ps", "-o", "comm=", "-p", str(ppid)],
                    capture_output=True, text=True, timeout=2,
                ).stdout.strip()
            except Exception:
                parent_cmd = "?"
            macos_hint = (
                "\n\nEvery device returned PortAudio paInternalError, which on macOS "
                "means this process has no microphone permission. "
                f"Parent process is {parent_cmd!r} (pid {ppid}); "
                "if that's `launchd`, Streamlit was started as a detached "
                "background process and macOS can't attach a permission prompt.\n\n"
                "Fix: kill the current Streamlit and relaunch from a GUI terminal "
                "(Terminal.app, iTerm, or a VS Code integrated terminal):\n"
                "  cd commandcenter && bash launch.sh\n\n"
                "On first record attempt, macOS will prompt for mic access. "
                "After granting, reload this page."
            )
        st.error(
            "Audio recording failed on every candidate device:\n"
            f"{lines}\n\n"
            f"Available inputs: {available}\n"
            "Override with `export CC_AUDIO_INPUT_DEVICE=<index or name>`."
            f"{macos_hint}"
        )
        return None, None
    except Exception as e:
        st.error(f"Audio recording failed: {e}")
        return None, None

def save_audio(recording, sample_rate, filename):
    """Save audio to a WAV file under AUDIO_DIR.

    Returns the output Path, or None if the recording is missing or empty.
    Normalizes 1D arrays to (frames, 1) because older soundfile versions
    index ``data.shape[1]`` unconditionally.
    """
    if recording is None or getattr(recording, "size", 0) == 0:
        return None
    data = recording
    if hasattr(data, "ndim") and data.ndim == 1:
        data = data.reshape(-1, 1)
    filepath = AUDIO_DIR / filename
    sf.write(str(filepath), data, sample_rate)
    return filepath

def transcribe_audio(filepath, model="base", language="en"):
    """Transcribe audio using local Whisper.

    Model choices trade speed for accuracy:
      tiny/base  — fast, fine for short clear memos
      small      — decent for meetings with one or two speakers
      medium     — better for multi-speaker meetings with accents
      large      — slowest, best accuracy

    Timeout scales with file duration so long meetings don't time out.
    """
    try:
        try:
            info = sf.info(str(filepath))
            duration_s = float(info.frames) / float(info.samplerate) if info.samplerate else 0
        except Exception:
            duration_s = 60
        # Whisper is roughly realtime-ish on CPU with base; give a generous
        # multiplier for larger models and a 2 min floor for tiny files.
        per_model = {"tiny": 2, "base": 3, "small": 6, "medium": 12, "large": 20}
        timeout = max(120, int(duration_s * per_model.get(model, 6)))
        subprocess.run(
            ['whisper', str(filepath),
             '--model', model,
             '--language', language,
             '--output_format', 'txt',
             '--output_dir', str(filepath.parent)],
            capture_output=True, text=True, timeout=timeout
        )
        txt_file = filepath.with_suffix('.txt')
        if txt_file.exists():
            return txt_file.read_text().strip()
        return "Transcription completed but no output file found"
    except subprocess.TimeoutExpired:
        return f"Error: whisper timed out (model={model}). Try a smaller model or split the file."
    except FileNotFoundError:
        return "Error: whisper CLI not found. Install with `pip install openai-whisper`."
    except Exception as e:
        return f"Error: {str(e)}"


# ── Streaming recorder (open-ended start/stop, no fixed duration) ─────────────
#
# The previous implementation blocked for a preset duration — useless for
# meetings. This version opens an sd.InputStream, appends frames via a
# callback, and lives in st.session_state so it survives Streamlit reruns
# (which re-execute the script top-to-bottom in the same process).

def start_recording_stream(sample_rate=16000):
    """Open a non-blocking input stream. Returns a handle dict or None."""
    try:
        devices = sd.query_devices()
        input_devices = [i for i, d in enumerate(devices) if d['max_input_channels'] > 0]
        if not input_devices:
            st.error("No audio input device detected on this system.")
            return None

        buf: list = []
        lock = threading.Lock()

        def _callback(indata, frames, time_info, status):
            with lock:
                buf.append(indata.copy())

        last_err = None
        for candidate in _input_device_candidates(devices, input_devices):
            name = devices[candidate]['name']
            try:
                sd.check_input_settings(
                    device=candidate, samplerate=sample_rate,
                    channels=1, dtype='float32',
                )
                stream = sd.InputStream(
                    samplerate=sample_rate, channels=1, dtype='float32',
                    device=candidate, callback=_callback,
                )
                stream.start()
                return {
                    "stream": stream,
                    "buf": buf,
                    "lock": lock,
                    "started_at": time.time(),
                    "sample_rate": sample_rate,
                    "device_name": name,
                }
            except Exception as e:
                last_err = f"{name}: {e}"
                continue
        st.error(f"Could not open any input device. Last error: {last_err}")
        return None
    except Exception as e:
        st.error(f"Recording failed to start: {e}")
        return None


def stop_recording_stream(handle, out_path):
    """Close the stream and flush buffered frames to a WAV file.

    Returns (path, duration_seconds) or (None, 0) on failure.
    """
    if not handle:
        return None, 0
    stream = handle.get("stream")
    try:
        if stream is not None:
            stream.stop()
            stream.close()
    except Exception:
        pass
    with handle["lock"]:
        chunks = list(handle["buf"])
    if not chunks:
        return None, 0
    data = np.concatenate(chunks, axis=0)
    if data.ndim == 1:
        data = data.reshape(-1, 1)
    sr = handle["sample_rate"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), data, sr)
    duration = data.shape[0] / sr
    return out_path, duration


def convert_to_wav(src_path, dest_path, sample_rate=16000):
    """Convert any ffmpeg-readable audio/video file to a mono 16kHz WAV."""
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', str(src_path),
             '-ac', '1', '-ar', str(sample_rate),
             '-vn', str(dest_path)],
            capture_output=True, text=True, check=True, timeout=600,
        )
        return dest_path if dest_path.exists() else None
    except FileNotFoundError:
        st.error("ffmpeg is not installed. `brew install ffmpeg` to enable uploads.")
        return None
    except subprocess.CalledProcessError as e:
        st.error(f"ffmpeg failed: {e.stderr[-400:] if e.stderr else e}")
        return None


# ── Recording metadata (JSON sidecar per WAV) ─────────────────────────────────

def meta_path(audio_path):
    return Path(audio_path).with_suffix('.json')


def load_recording_meta(audio_path):
    p = meta_path(audio_path)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    # Synthesize minimal metadata from filename conventions
    name = Path(audio_path).name
    rtype = "meeting" if name.startswith("meeting_") else "memo"
    return {
        "id": Path(audio_path).stem,
        "type": rtype,
        "title": "",
        "attendees": "",
        "tags": [],
        "created": datetime.datetime.fromtimestamp(Path(audio_path).stat().st_mtime).isoformat(),
        "duration_sec": 0,
        "model": "",
        "analyses": {},
    }


def save_recording_meta(audio_path, meta):
    meta_path(audio_path).write_text(json.dumps(meta, indent=2))


# ── Analysis prompts (memo vs. meeting) ───────────────────────────────────────

MEETING_ANALYSIS_PROMPT = """You are analyzing a meeting transcript. Produce clean markdown with these sections, in order:

## Summary
3-6 bullets covering the purpose, key points, and outcome.

## Action Items
A markdown table with columns: Owner | Action | Deadline (use "—" if unknown).
Only include items that are actual commitments, not hypotheticals.

## Decisions
Bulleted list of decisions that were made. If none, write "None".

## Open Questions / Follow-ups
Bulleted list of unresolved questions or follow-ups. If none, write "None".

## Topics Discussed
Bulleted list of the main topics, in order they came up.

Context:
- Title: {title}
- Attendees: {attendees}
- Tags: {tags}

Transcript:
{transcript}
"""

MEMO_SUMMARY_PROMPT = """Summarize this voice memo in 3-5 crisp bullets. Keep concrete details (numbers, names, dates). Don't pad.

Memo:
{transcript}
"""

TASK_EXTRACT_PROMPT = """Extract every actionable task from the text below. Return ONLY a JSON array — no prose, no markdown fences — where each item has:
  title    — short imperative sentence
  priority — one of: High, Medium, Low
  notes    — optional context (empty string if none)

If no tasks, return [].

Text:
{transcript}
"""


def analyze_meeting(transcript, title="", attendees="", tags="", model=None):
    if not transcript or transcript.startswith("Error"):
        return "_No transcript to analyze._"
    prompt = MEETING_ANALYSIS_PROMPT.format(
        title=title or "(untitled)",
        attendees=attendees or "(unspecified)",
        tags=tags or "(none)",
        transcript=transcript,
    )
    return query_ollama(prompt, model=model or st.session_state.selected_model)


def summarize_memo(transcript, model=None):
    if not transcript or transcript.startswith("Error"):
        return "_No transcript to summarize._"
    return query_ollama(
        MEMO_SUMMARY_PROMPT.format(transcript=transcript),
        model=model or st.session_state.selected_model,
    )


def extract_tasks_from_transcript(transcript, model=None):
    """Call the LLM, parse a JSON array of tasks, return list[dict]."""
    if not transcript or transcript.startswith("Error"):
        return []
    raw = query_ollama(
        TASK_EXTRACT_PROMPT.format(transcript=transcript),
        model=model or st.session_state.selected_model,
    )
    # Model may wrap in ``` or prefix with prose — be forgiving.
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n|\n```$", "", text)
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1:
        return []
    try:
        items = json.loads(text[start:end + 1])
        out = []
        for it in items if isinstance(items, list) else []:
            if not isinstance(it, dict):
                continue
            title = (it.get("title") or "").strip()
            if not title:
                continue
            pri = (it.get("priority") or "Medium").strip().capitalize()
            emoji = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}.get(pri, "🟡")
            out.append({
                "title": title,
                "priority": f"{emoji} {pri}",
                "notes": (it.get("notes") or "").strip(),
            })
        return out
    except Exception:
        return []

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
    all_models = models + ["anthropic/claude-opus-4.7", "anthropic/claude-sonnet-4.6", "anthropic/claude-haiku-4.5", "google/gemini-2.5-pro"]
    
    try:
        _default_idx = all_models.index(st.session_state.selected_model)
    except ValueError:
        _default_idx = all_models.index("llama3.2:latest") if "llama3.2:latest" in all_models else 0
    selected_model = st.selectbox(
        "🤖 Active Model",
        all_models,
        index=_default_idx,
    )
    st.session_state.selected_model = selected_model
    
    # Show if local or API
    if selected_model in models:
        st.markdown(f'<span class="model-badge">🏠 LOCAL</span>', unsafe_allow_html=True)
    else:
        st.markdown(f'<span class="model-badge">☁️ API</span>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Navigation. Streamlit gotchas this dance avoids:
    #   1. You can't pass BOTH `index=` and `key=` while also setting
    #      st.session_state[key] elsewhere — raises a "default value +
    #      session_state value" exception that silently kills the run.
    #   2. You can't write to a widget-keyed state slot AFTER the widget
    #      has rendered in the same run — also raises an exception.
    # Solution: key= only (no index=), and route page changes from
    # buttons through a "_cc_page_pending" slot that we consume at the
    # top of the sidebar BEFORE the radio renders.
    PAGES = [
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
        "⚙️ Settings",
    ]
    if "cc_page" not in st.session_state:
        st.session_state.cc_page = PAGES[0]
    pending = st.session_state.pop("_cc_page_pending", None)
    if pending in PAGES:
        st.session_state.cc_page = pending
    page = st.radio(
        "Navigate",
        PAGES,
        key="cc_page",
        label_visibility="collapsed",
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
        st.metric("📋 Tasks", len([t for t in tasks if t.get('status') == 'pending']))
    with col2:
        st.metric("💡 Ideas", len(ideas))
    with col3:
        st.metric("🛠️ Skills", len(skills))
    with col4:
        st.metric("🎤 Memos", audio_count)
    with col5:
        st.metric("📸 Captures", screenshot_count)

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
                st.session_state._cc_page_pending = "🎤 Capture"
                st.rerun()
            if st.button("📸 Screenshot", use_container_width=True):
                filepath = take_screenshot()
                st.success(f"Saved: {filepath.name}")
            if st.button("➕ New Task", use_container_width=True):
                st.session_state.quick_action = "task"
        with qa_col2:
            if st.button("💡 New Idea", use_container_width=True):
                st.session_state._cc_page_pending = "💡 Ideas Lab"
                st.rerun()
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

                result = ask_cloud(prompt)
                st.markdown(result)

                # NOTE: parsing the LLM-generated subtask list back into
                # structured tasks needs a stable output format. Until that's
                # wired up, fall back to manual: copy the first line of each
                # numbered item into a new task.
                if st.button("📥 Import as Tasks"):
                    if not result:
                        st.warning("Run an analysis first.")
                    else:
                        existing = load_tasks()
                        next_id = max((t['id'] for t in existing), default=0) + 1
                        added = 0
                        for line in result.splitlines():
                            stripped = line.strip()
                            m = re.match(r"^\d+[\.\)]\s+\*?\*?(.+?)\*?\*?$", stripped)
                            if not m:
                                continue
                            title = re.sub(r"[*_`]", "", m.group(1)).strip()
                            if not title:
                                continue
                            existing.append({
                                "id": next_id,
                                "title": title,
                                "priority": "🟡 Medium",
                                "status": "pending",
                                "created": datetime.datetime.now().isoformat(),
                                "notes": "",
                            })
                            next_id += 1
                            added += 1
                        if added:
                            save_tasks(existing)
                            st.success(f"Imported {added} task(s).")
                            st.rerun()
                        else:
                            st.info("No numbered subtasks found in the analysis.")
    
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
                            result = run_hermes(f"Complete this task: {task['title']}", model=CLOUD_TASK_MODEL)
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

    tab1, tab2, tab3 = st.tabs(["🎙️ Audio", "📸 Screenshot", "🎬 Screen Recording"])

    with tab1:
        # ── Sub-tabs for audio workflows ──────────────────────────────────
        a_memo, a_meeting, a_library, a_upload = st.tabs(
            ["📝 Memo", "🎥 Meeting", "📂 Library", "📎 Upload"]
        )

        WHISPER_MODELS = ["tiny", "base", "small", "medium", "large"]

        # Shared: recording state
        if "rec_handle" not in st.session_state:
            st.session_state.rec_handle = None
        if "rec_mode" not in st.session_state:
            st.session_state.rec_mode = None  # "memo" or "meeting"
        if "rec_last" not in st.session_state:
            st.session_state.rec_last = None  # dict: path, duration, meta

        def _fmt_elapsed(seconds):
            seconds = int(seconds)
            h, rem = divmod(seconds, 3600)
            m, s = divmod(rem, 60)
            return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"

        # ── MEMO ──────────────────────────────────────────────────────────
        with a_memo:
            st.markdown("#### Quick Voice Memo")
            st.caption("Hit record, speak, hit stop. Transcribed with Whisper.")

            memo_model = st.selectbox(
                "Whisper model",
                WHISPER_MODELS, index=1,
                help="tiny/base are fastest; use small+ for noisier audio",
                key="memo_whisper_model",
            )

            is_recording = (
                st.session_state.rec_handle is not None
                and st.session_state.rec_mode == "memo"
            )

            c1, c2 = st.columns(2)
            with c1:
                if not is_recording and st.button(
                    "🔴 Start Recording", type="primary", use_container_width=True,
                    key="memo_start",
                ):
                    handle = start_recording_stream()
                    if handle:
                        st.session_state.rec_handle = handle
                        st.session_state.rec_mode = "memo"
                        st.rerun()
            with c2:
                if is_recording and st.button(
                    "⏹ Stop & Transcribe", type="primary", use_container_width=True,
                    key="memo_stop",
                ):
                    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    out = AUDIO_DIR / f"memo_{ts}.wav"
                    path, dur = stop_recording_stream(st.session_state.rec_handle, out)
                    st.session_state.rec_handle = None
                    st.session_state.rec_mode = None
                    if path is None:
                        st.error("No audio captured.")
                    else:
                        with st.spinner(f"Transcribing ({memo_model})…"):
                            transcript = transcribe_audio(path, model=memo_model)
                        meta = load_recording_meta(path)
                        meta.update({
                            "type": "memo",
                            "duration_sec": round(dur, 1),
                            "model": memo_model,
                            "created": datetime.datetime.now().isoformat(),
                        })
                        save_recording_meta(path, meta)
                        st.session_state.rec_last = {
                            "path": str(path), "duration": dur,
                            "transcript": transcript, "meta": meta,
                        }
                        st.rerun()

            if is_recording:
                elapsed = time.time() - st.session_state.rec_handle["started_at"]
                st.markdown(
                    f"<h2 style='color:#e74c3c; margin-top:12px;'>🔴 {_fmt_elapsed(elapsed)}</h2>"
                    f"<div style='color:#9ca3af;'>Device: {st.session_state.rec_handle['device_name']}</div>",
                    unsafe_allow_html=True,
                )

            # Post-recording panel
            last = st.session_state.rec_last
            if last and last["meta"].get("type") == "memo" and not is_recording:
                st.markdown("---")
                st.markdown(f"**Saved:** `{Path(last['path']).name}` · {_fmt_elapsed(last['duration'])}")
                st.audio(last["path"])
                st.markdown("**Transcript**")
                st.text_area(" ", last["transcript"], height=160, key="memo_transcript", label_visibility="collapsed")
                b1, b2, b3 = st.columns(3)
                with b1:
                    if st.button("📝 Summarize", key="memo_summarize"):
                        with st.spinner("Summarizing…"):
                            summary = summarize_memo(last["transcript"])
                        meta = last["meta"]
                        meta.setdefault("analyses", {})["summary"] = summary
                        save_recording_meta(last["path"], meta)
                        st.markdown(summary)
                with b2:
                    if st.button("✅ Extract tasks", key="memo_extract"):
                        with st.spinner("Extracting tasks…"):
                            items = extract_tasks_from_transcript(last["transcript"])
                        if not items:
                            st.info("No actionable tasks found.")
                        else:
                            tasks = load_tasks()
                            now = datetime.datetime.now().isoformat()
                            for it in items:
                                tasks.append({
                                    "id": (max((t["id"] for t in tasks), default=0) + 1),
                                    "title": it["title"],
                                    "priority": it["priority"],
                                    "status": "pending",
                                    "created": now,
                                    "notes": it["notes"],
                                })
                            save_tasks(tasks)
                            st.success(f"Added {len(items)} task(s) to the board.")
                            for it in items:
                                st.markdown(f"- {it['priority']} {it['title']}")
                with b3:
                    if st.button("🗑 Clear", key="memo_clear"):
                        st.session_state.rec_last = None
                        st.rerun()

        # ── MEETING ───────────────────────────────────────────────────────
        with a_meeting:
            st.markdown("#### Record a Meeting")
            st.caption("Open-ended recording with structured analysis: summary, action items, decisions, follow-ups.")

            mt_title = st.text_input("Title", key="meeting_title", placeholder="e.g., Marketing sync — 2026-04-24")
            mt_attendees = st.text_input("Attendees", key="meeting_attendees", placeholder="Alice, Bob, Carol")
            mt_tags = st.text_input("Tags", key="meeting_tags", placeholder="comma,separated,tags")
            mt_model = st.selectbox(
                "Whisper model",
                WHISPER_MODELS, index=2,
                help="`small` is a good default for meetings; `medium`/`large` for noisy/multi-speaker",
                key="meeting_whisper_model",
            )

            is_recording = (
                st.session_state.rec_handle is not None
                and st.session_state.rec_mode == "meeting"
            )

            c1, c2 = st.columns(2)
            with c1:
                if not is_recording and st.button(
                    "🔴 Start Meeting", type="primary", use_container_width=True,
                    key="mt_start",
                ):
                    handle = start_recording_stream()
                    if handle:
                        st.session_state.rec_handle = handle
                        st.session_state.rec_mode = "meeting"
                        st.session_state._pending_meeting_meta = {
                            "title": mt_title,
                            "attendees": mt_attendees,
                            "tags": [t.strip() for t in mt_tags.split(",") if t.strip()],
                        }
                        st.rerun()
            with c2:
                if is_recording and st.button(
                    "⏹ Stop & Analyze", type="primary", use_container_width=True,
                    key="mt_stop",
                ):
                    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    out = AUDIO_DIR / f"meeting_{ts}.wav"
                    path, dur = stop_recording_stream(st.session_state.rec_handle, out)
                    st.session_state.rec_handle = None
                    st.session_state.rec_mode = None
                    if path is None:
                        st.error("No audio captured.")
                    else:
                        with st.spinner(f"Transcribing ({mt_model}) — this can take a while for long meetings…"):
                            transcript = transcribe_audio(path, model=mt_model)
                        pending = st.session_state.pop("_pending_meeting_meta", {})
                        meta = load_recording_meta(path)
                        meta.update({
                            "type": "meeting",
                            "title": pending.get("title", ""),
                            "attendees": pending.get("attendees", ""),
                            "tags": pending.get("tags", []),
                            "duration_sec": round(dur, 1),
                            "model": mt_model,
                            "created": datetime.datetime.now().isoformat(),
                        })
                        save_recording_meta(path, meta)
                        st.session_state.rec_last = {
                            "path": str(path), "duration": dur,
                            "transcript": transcript, "meta": meta,
                        }
                        st.rerun()

            if is_recording:
                elapsed = time.time() - st.session_state.rec_handle["started_at"]
                pend = st.session_state.get("_pending_meeting_meta", {})
                st.markdown(
                    f"<h2 style='color:#e74c3c; margin-top:12px;'>🔴 {_fmt_elapsed(elapsed)}</h2>"
                    f"<div style='color:#9ca3af;'>"
                    f"{pend.get('title') or '(untitled meeting)'} · "
                    f"Device: {st.session_state.rec_handle['device_name']}"
                    f"</div>",
                    unsafe_allow_html=True,
                )

            last = st.session_state.rec_last
            if last and last["meta"].get("type") == "meeting" and not is_recording:
                st.markdown("---")
                meta = last["meta"]
                st.markdown(
                    f"**{meta.get('title') or Path(last['path']).name}** · "
                    f"{_fmt_elapsed(last['duration'])} · "
                    f"{meta.get('attendees') or '(no attendees)'}"
                )
                st.audio(last["path"])
                with st.expander("Transcript", expanded=False):
                    st.text_area(" ", last["transcript"], height=240,
                                 key="meeting_transcript", label_visibility="collapsed")

                if "analysis" not in meta.get("analyses", {}):
                    if st.button("🧠 Run full meeting analysis", type="primary", key="mt_analyze"):
                        with st.spinner("Analyzing meeting (summary, action items, decisions, follow-ups)…"):
                            analysis = analyze_meeting(
                                last["transcript"],
                                title=meta.get("title", ""),
                                attendees=meta.get("attendees", ""),
                                tags=", ".join(meta.get("tags", [])),
                            )
                        meta.setdefault("analyses", {})["analysis"] = analysis
                        save_recording_meta(last["path"], meta)
                        st.rerun()
                else:
                    st.markdown("### 🧠 Meeting Analysis")
                    st.markdown(meta["analyses"]["analysis"])
                    if st.button("✅ Extract action items into tasks", key="mt_extract"):
                        with st.spinner("Extracting action items…"):
                            items = extract_tasks_from_transcript(last["transcript"])
                        if not items:
                            st.info("No actionable tasks found.")
                        else:
                            tasks = load_tasks()
                            now = datetime.datetime.now().isoformat()
                            mt_prefix = f"[{meta.get('title') or 'Meeting'}] "
                            for it in items:
                                tasks.append({
                                    "id": (max((t["id"] for t in tasks), default=0) + 1),
                                    "title": mt_prefix + it["title"],
                                    "priority": it["priority"],
                                    "status": "pending",
                                    "created": now,
                                    "notes": it["notes"],
                                })
                            save_tasks(tasks)
                            st.success(f"Added {len(items)} task(s) to the board.")

        # ── LIBRARY ───────────────────────────────────────────────────────
        with a_library:
            st.markdown("#### Recording Library")
            st.caption("Search, replay, re-transcribe, re-analyze.")

            fcol1, fcol2, fcol3 = st.columns([2, 1, 1])
            with fcol1:
                search = st.text_input("🔍 Search", key="lib_search",
                                       placeholder="title, attendee, tag, or text in transcript")
            with fcol2:
                type_filter = st.selectbox("Type", ["all", "meeting", "memo"], key="lib_type")
            with fcol3:
                sort_by = st.selectbox("Sort", ["newest", "oldest", "longest"], key="lib_sort")

            audio_files = list(AUDIO_DIR.glob("*.wav"))
            # Match search against title/attendees/tags/transcript
            def _match(af):
                if type_filter != "all":
                    m = load_recording_meta(af)
                    if m.get("type") != type_filter:
                        return False
                if not search:
                    return True
                needle = search.lower()
                m = load_recording_meta(af)
                hay = " ".join([
                    m.get("title", ""), m.get("attendees", ""),
                    " ".join(m.get("tags", [])),
                ]).lower()
                if needle in hay:
                    return True
                txt = af.with_suffix('.txt')
                if txt.exists() and needle in txt.read_text().lower():
                    return True
                return False

            audio_files = [af for af in audio_files if _match(af)]
            if sort_by == "newest":
                audio_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            elif sort_by == "oldest":
                audio_files.sort(key=lambda p: p.stat().st_mtime)
            else:
                audio_files.sort(
                    key=lambda p: load_recording_meta(p).get("duration_sec", 0),
                    reverse=True,
                )

            if not audio_files:
                st.info("No recordings match. Try clearing the filters.")

            for af in audio_files[:30]:
                meta = load_recording_meta(af)
                icon = "🎥" if meta.get("type") == "meeting" else "📝"
                title = meta.get("title") or af.stem
                dur = meta.get("duration_sec") or 0
                label = f"{icon} {title} · {_fmt_elapsed(dur)} · {meta.get('created', '')[:16]}"
                with st.expander(label):
                    st.audio(str(af))
                    txt = af.with_suffix('.txt')
                    transcript = txt.read_text() if txt.exists() else ""
                    if meta.get("attendees"):
                        st.markdown(f"**Attendees:** {meta['attendees']}")
                    if meta.get("tags"):
                        st.markdown("**Tags:** " + ", ".join(meta["tags"]))
                    if transcript:
                        with st.expander("Transcript", expanded=False):
                            st.text_area(" ", transcript, height=200,
                                         key=f"tr_{af.name}", label_visibility="collapsed")
                    for aname, atext in (meta.get("analyses") or {}).items():
                        with st.expander(f"🧠 {aname.replace('_', ' ').title()}", expanded=False):
                            st.markdown(atext)

                    bcol1, bcol2, bcol3, bcol4 = st.columns(4)
                    with bcol1:
                        retr_model = st.selectbox(
                            "Re-transcribe",
                            WHISPER_MODELS,
                            index=WHISPER_MODELS.index(meta.get("model") or "base")
                                if (meta.get("model") in WHISPER_MODELS) else 1,
                            key=f"retr_m_{af.name}",
                        )
                    with bcol2:
                        if st.button("🔁 Run", key=f"retr_{af.name}"):
                            with st.spinner(f"Transcribing ({retr_model})…"):
                                new_tr = transcribe_audio(af, model=retr_model)
                            meta["model"] = retr_model
                            save_recording_meta(af, meta)
                            st.success("Transcribed. Refresh to see updated transcript.")
                    with bcol3:
                        analysis_label = "🧠 Re-analyze" if "analysis" in (meta.get("analyses") or {}) else "🧠 Analyze"
                        if st.button(analysis_label, key=f"ana_{af.name}"):
                            if not transcript:
                                st.warning("No transcript yet — re-transcribe first.")
                            else:
                                with st.spinner("Analyzing…"):
                                    if meta.get("type") == "meeting":
                                        res = analyze_meeting(
                                            transcript,
                                            title=meta.get("title", ""),
                                            attendees=meta.get("attendees", ""),
                                            tags=", ".join(meta.get("tags", [])),
                                        )
                                    else:
                                        res = summarize_memo(transcript)
                                meta.setdefault("analyses", {})["analysis" if meta.get("type") == "meeting" else "summary"] = res
                                save_recording_meta(af, meta)
                                st.rerun()
                    with bcol4:
                        if st.button("🗑 Delete", key=f"del_{af.name}"):
                            for p in [af, af.with_suffix('.txt'), meta_path(af)]:
                                try:
                                    if p.exists():
                                        p.unlink()
                                except Exception:
                                    pass
                            st.rerun()

        # ── UPLOAD ────────────────────────────────────────────────────────
        with a_upload:
            st.markdown("#### Upload Audio or Video")
            st.caption("Drop in Zoom recordings, phone voice memos, or any audio/video file. Converted to WAV via ffmpeg, then transcribed.")

            up = st.file_uploader(
                "File",
                type=["wav", "mp3", "m4a", "aac", "ogg", "flac", "mp4", "mov", "webm", "mkv"],
                key="audio_upload",
            )
            up_type = st.radio("Type", ["meeting", "memo"], horizontal=True, key="up_type")
            up_title = st.text_input("Title", key="up_title")
            up_attendees = st.text_input("Attendees (meetings)", key="up_attendees") if up_type == "meeting" else ""
            up_tags = st.text_input("Tags", key="up_tags", placeholder="comma,separated")
            up_model = st.selectbox(
                "Whisper model", WHISPER_MODELS,
                index=2 if up_type == "meeting" else 1,
                key="up_whisper_model",
            )

            if up and st.button("📥 Ingest & Transcribe", type="primary", key="up_go"):
                ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                prefix = "meeting" if up_type == "meeting" else "memo"
                src = AUDIO_DIR / f"upload_src_{ts}_{up.name}"
                src.write_bytes(up.getvalue())
                wav_path = AUDIO_DIR / f"{prefix}_{ts}.wav"
                with st.spinner("Converting to WAV…"):
                    conv = convert_to_wav(src, wav_path)
                try:
                    src.unlink()
                except Exception:
                    pass
                if conv is None:
                    st.error("Conversion failed.")
                else:
                    with st.spinner(f"Transcribing ({up_model})…"):
                        transcript = transcribe_audio(conv, model=up_model)
                    try:
                        info = sf.info(str(conv))
                        dur = float(info.frames) / float(info.samplerate)
                    except Exception:
                        dur = 0
                    meta = load_recording_meta(conv)
                    meta.update({
                        "type": up_type,
                        "title": up_title,
                        "attendees": up_attendees,
                        "tags": [t.strip() for t in up_tags.split(",") if t.strip()],
                        "duration_sec": round(dur, 1),
                        "model": up_model,
                        "created": datetime.datetime.now().isoformat(),
                        "source": up.name,
                    })
                    save_recording_meta(conv, meta)
                    st.session_state.rec_last = {
                        "path": str(conv), "duration": dur,
                        "transcript": transcript, "meta": meta,
                    }
                    st.success(f"Ingested `{up.name}`. Open it in the **Library** tab or run analysis below.")
                    with st.expander("Transcript", expanded=True):
                        st.text_area(" ", transcript, height=200,
                                     key="up_transcript", label_visibility="collapsed")

        # ── Auto-refresh while recording so the timer ticks ───────────────
        if st.session_state.rec_handle is not None:
            time.sleep(1)
            st.rerun()

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

                        breakdown = ask_cloud(prompt)
                        
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
4. Suggest relevant skills and tools""", model=CLOUD_TASK_MODEL)

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
                            idea['breakdown'] = ask_cloud(prompt, model=CLOUD_FAST_MODEL)
                            idea['status'] = 'analyzed'
                            save_ideas(ideas)
                            st.rerun()
                with col2:
                    if st.button("📋 → Tasks", key=f"totask_idea_{idea['id']}"):
                        existing = load_tasks()
                        new_id = max((t['id'] for t in existing), default=0) + 1
                        existing.append({
                            "id": new_id,
                            "title": f"[Idea] {idea['title']}",
                            "priority": "🟡 Medium",
                            "status": "pending",
                            "created": datetime.datetime.now().isoformat(),
                            "notes": idea.get('description', ''),
                        })
                        save_tasks(existing)
                        idea['status'] = 'in_progress'
                        save_ideas(ideas)
                        st.success(f"Added task #{new_id} from idea.")
                        st.rerun()
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

                        result = ask_cloud(prompts[analysis_type])
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
                    
                    result = run_hermes(prompt, skill="shopify-site-clone", model=CLOUD_TASK_MODEL)
                    st.markdown(f'<div class="terminal-output">{result["output"]}</div>', unsafe_allow_html=True)
            
            if st.button("🚀 Start Migration"):
                if not source_url or not target_store:
                    st.warning("Need both source URL and target store.")
                else:
                    with st.spinner("Hermes orchestrating Shopify migration…"):
                        prompt = (
                            f"Use the shopify-site-clone skill to migrate "
                            f"{source_url} into {target_store}. "
                            f"Include: products={clone_products}, "
                            f"theme={clone_theme}, pages={clone_pages}, "
                            f"blog={clone_blog}. "
                            f"Report each phase as you go."
                        )
                        result = run_hermes(prompt, skill="shopify-site-clone",
                                            model=CLOUD_TASK_MODEL)
                    st.markdown(
                        f'<div class="terminal-output">{result["output"]}</div>',
                        unsafe_allow_html=True,
                    )
                    if result.get('error'):
                        st.error(result['error'])
        
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

                    result = ask_cloud(prompt)
                    st.markdown(f'<div class="hermes-response">{result}</div>', unsafe_allow_html=True)

            if st.button("🚀 Build with Hermes"):
                with st.spinner("Hermes is building your website..."):
                    result = run_hermes(f"Build a {site_type} website: {project_desc}", model=CLOUD_TASK_MODEL)
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
            dispatch_default_idx = all_models.index(CLOUD_TASK_MODEL) if CLOUD_TASK_MODEL in all_models else 0
            dispatch_model = st.selectbox("Model", all_models, index=dispatch_default_idx, key="commandeer_model")
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

        jobs = get_cron_jobs()

        if not jobs:
            st.info("No scheduled jobs. Create one in the 'New Job' tab.")

        for idx, job in enumerate(jobs):
            jid = job.get('id', idx)
            status = job.get('status', 'active')
            st.markdown(f"""
            <div class="cron-job">
                <strong>{job.get('name', 'Unnamed Job')}</strong><br>
                <small>Schedule: {job.get('schedule', 'N/A')}</small><br>
                <small>Status: {status}</small>
            </div>
            """, unsafe_allow_html=True)

            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("▶️ Run Now", key=f"run_job_{jid}"):
                    with st.spinner("Running job…"):
                        result = run_hermes(job.get('prompt', ''))
                    if result.get('success'):
                        st.success("Job ran successfully.")
                        with st.expander("Output", expanded=False):
                            st.text(result.get('output', '')[:2000])
                    else:
                        st.error(result.get('error') or "Job failed.")
            with col2:
                pause_label = "▶️ Resume" if status == "paused" else "⏸️ Pause"
                if st.button(pause_label, key=f"pause_job_{jid}"):
                    job['status'] = 'active' if status == 'paused' else 'paused'
                    save_cron_jobs(jobs)
                    st.rerun()
            with col3:
                if st.button("🗑️ Delete", key=f"del_job_{jid}"):
                    jobs = [j for j in jobs if j.get('id', -1) != jid]
                    save_cron_jobs(jobs)
                    st.rerun()
    
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
            if not job_name or not job_prompt:
                st.warning("Need both a name and a prompt.")
            else:
                jobs = get_cron_jobs()
                new_id = max((j.get('id', 0) for j in jobs), default=0) + 1
                jobs.append({
                    "id": new_id,
                    "name": job_name,
                    "schedule": schedule,
                    "prompt": job_prompt,
                    "deliver": deliver_to,
                    "status": "active",
                    "created": datetime.datetime.now().isoformat(),
                })
                save_cron_jobs(jobs)
                st.success(f"Created job #{new_id}: {job_name}")
                st.code(f'hermes /cron create "{schedule}" {job_prompt}',
                        language="bash")

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
        new_memory = st.text_area("New memory entry:", height=100, key="cc_new_memory")
        if st.button("💾 Save to Memory"):
            if not new_memory.strip():
                st.warning("Type something first.")
            else:
                with st.spinner("Adding to memory..."):
                    result = run_hermes(f"Remember this: {new_memory}")
                if result.get('success'):
                    st.success("Memory updated!")
                    st.rerun()
                else:
                    st.error(result.get('error') or "Failed to update memory.")
    
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
        new_profile_info = st.text_area("Add profile information:", height=100, key="cc_new_profile")
        if st.button("👤 Update Profile"):
            if not new_profile_info.strip():
                st.warning("Type something first.")
            else:
                with st.spinner("Updating profile..."):
                    result = run_hermes(f"Update my profile with: {new_profile_info}")
                if result.get('success'):
                    st.success("Profile updated!")
                    st.rerun()
                else:
                    st.error(result.get('error') or "Failed to update profile.")
    
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

    def _hermes_cli(args, label):
        try:
            result = subprocess.run(
                ['hermes'] + args, capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                st.success(f"{label} complete.")
                if result.stdout.strip():
                    st.code(result.stdout[:4000])
            else:
                st.error(f"{label} failed: {result.stderr or result.stdout}")
        except FileNotFoundError:
            st.error("`hermes` CLI not found in PATH.")
        except subprocess.TimeoutExpired:
            st.error(f"{label} timed out.")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("📥 Export Current Session", use_container_width=True):
            export_path = EXPORTS_DIR / f"session_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            try:
                if sessions_db.exists():
                    export_path.write_bytes(sessions_db.read_bytes())
                    st.success(f"Exported to: {export_path}")
                else:
                    st.warning("No sessions database to export.")
            except Exception as e:
                st.error(f"Export failed: {e}")
        if st.button("🔄 Resume Last Session", use_container_width=True):
            _hermes_cli(['/resume'], "Resume")
    with col2:
        if st.button("🗑️ Clear Session", use_container_width=True):
            _hermes_cli(['/reset'], "Reset")
        if st.button("📊 Session Stats", use_container_width=True):
            _hermes_cli(['session', 'stats'], "Stats")

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

        def _set_default_model(provider_model: str):
            """Persist a new default model into Hermes config."""
            cfg = get_hermes_config() or {}
            cfg.setdefault('model', {})
            if '/' in provider_model:
                provider, model_name = provider_model.split('/', 1)
                cfg['model']['provider'] = provider
                cfg['model']['default'] = model_name
            else:
                cfg['model']['default'] = provider_model
            save_hermes_config(cfg)
            st.success(f"Default model set to {provider_model}")

        models = get_ollama_models()
        for m in models:
            col1, col2 = st.columns([3, 1])
            with col1:
                st.markdown(f"• `{m}`")
            with col2:
                if st.button("Set Default", key=f"setdef_{m}"):
                    _set_default_model(f"ollama/{m}")
                    st.rerun()

        st.markdown("---")
        st.markdown("#### Quick Model Switch")

        presets = {
            "🏠 Local Fast (gemma4:31b)": "ollama/gemma4:31b",
            "🏠 Local Power (llama3.3)": "ollama/llama3.3:latest",
            "🏠 Local Max (gpt-oss:120b)": "ollama/gpt-oss:120b",
            "☁️ Claude Opus": "anthropic/claude-opus-4.7",
            "☁️ Claude Sonnet": "anthropic/claude-sonnet-4.6",
            "☁️ Claude Haiku": "anthropic/claude-haiku-4.5",
            "☁️ Gemini Pro": "google/gemini-2.5-pro",
        }

        for name, model in presets.items():
            if st.button(name, key=f"preset_{model}", use_container_width=True):
                _set_default_model(model)
                st.rerun()
    
    with tab2:
        st.markdown("#### Hermes Configuration")
        
        config = get_hermes_config()
        
        with st.expander("View Full Config", expanded=False):
            st.code(yaml.dump(config, default_flow_style=False))
        
        st.markdown("---")
        st.markdown("#### Key Settings")

        smart_routing = config.get('smart_model_routing', {}) or {}
        compression = config.get('compression', {}) or {}

        new_smart = st.checkbox(
            "Smart Model Routing",
            value=bool(smart_routing.get('enabled', False)),
            key="cc_smart_routing",
        )
        new_compress = st.checkbox(
            "Context Compression",
            value=bool(compression.get('enabled', True)),
            key="cc_compression",
        )

        if (new_smart != bool(smart_routing.get('enabled', False))
                or new_compress != bool(compression.get('enabled', True))):
            if st.button("💾 Save Settings", type="primary", key="save_hermes_settings"):
                config.setdefault('smart_model_routing', {})['enabled'] = new_smart
                config.setdefault('compression', {})['enabled'] = new_compress
                save_hermes_config(config)
                st.success("Hermes config updated.")
                st.rerun()
        
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
