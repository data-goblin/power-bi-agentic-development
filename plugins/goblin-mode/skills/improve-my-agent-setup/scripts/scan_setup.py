#!/usr/bin/env python3
"""Gather deterministic facts about an agentic-development setup.

Walks ~/.claude and the current git project to collect what can be measured
without judgment: the skills installed and where they came from, the size of
memory / context files, harness config (statusline, hooks, permissions,
model), which CLIs and MCP servers are wired up, git logging, and transcript
volume. Emits one JSON object to stdout. It never prints secret values; env
vars and connection strings are reported by key only. The SKILL.md turns these
facts into an interpreted, scored report; this script only measures.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
CLAUDE = HOME / ".claude"
CHARS_PER_TOKEN = 4  # rough estimate; good enough for budgeting


def est_tokens(text: str) -> int:
    return round(len(text) / CHARS_PER_TOKEN)


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def load_json(p: Path):
    try:
        return json.loads(read_text(p))
    except Exception:
        return None


def git(args, cwd):
    try:
        out = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=8
        )
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


# region skills


def skill_meta(skill_md: Path) -> dict:
    """Pull name + description from a SKILL.md frontmatter, cheaply."""
    text = read_text(skill_md)
    name = desc = ""
    m = re.search(r"^name:\s*(.+)$", text, re.MULTILINE)
    if m:
        name = m.group(1).strip()
    m = re.search(r"^description:\s*(.+)$", text, re.MULTILINE)
    if m:
        desc = m.group(1).strip()
    return {
        "name": name or skill_md.parent.name,
        "description": desc,
        "lines": text.count("\n") + 1,
        "tokens": est_tokens(text),
    }


def scan_skills() -> dict:
    personal_dir = CLAUDE / "skills"
    personal = []
    if personal_dir.exists():
        for md in personal_dir.rglob("SKILL.md"):
            personal.append(skill_meta(md))

    plugin_skills = []
    for base in [CLAUDE / "plugins" / "marketplaces", CLAUDE / "plugins" / "cache"]:
        if base.exists():
            for md in base.rglob("SKILL.md"):
                meta = skill_meta(md)
                meta["source"] = md.relative_to(CLAUDE).parts[2] if len(md.relative_to(CLAUDE).parts) > 2 else "plugin"
                plugin_skills.append(meta)

    # is the personal skills dir shared (git repo or symlink)?
    shared = {
        "is_symlink": personal_dir.is_symlink() if personal_dir.exists() else False,
        "is_git_repo": (personal_dir / ".git").exists()
        or bool(git(["rev-parse", "--is-inside-work-tree"], personal_dir))
        if personal_dir.exists()
        else False,
    }

    # crude overlap signal: skills whose names share a stem word
    names = [s["name"] for s in personal + plugin_skills if s["name"]]
    stems = {}
    for n in names:
        for w in re.split(r"[-_\s]+", n.lower()):
            if len(w) >= 4:
                stems.setdefault(w, []).append(n)
    overlap = {w: v for w, v in stems.items() if len(set(v)) > 1}

    return {
        "personal_count": len(personal),
        "plugin_count": len(plugin_skills),
        "personal": personal,
        "plugin": plugin_skills,
        "shared_dir": shared,
        "name_overlap": overlap,
    }


# endregion

# region memory / context files


def _pointer_target(text: str):
    """If a memory file is essentially just an import (e.g. '@AGENTS.md'),
    return the imported path; else None. Blank lines and comments ignored."""
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.strip().startswith("#")]
    if len(lines) == 1 and lines[0].startswith("@"):
        return lines[0][1:].strip()
    imports = [l for l in lines if l.startswith("@")]
    if lines and len(imports) == len(lines):
        return ", ".join(i[1:].strip() for i in imports)
    return None


def scan_memory(project: Path) -> dict:
    files = []
    candidates = [
        CLAUDE / "CLAUDE.md",
        CLAUDE / "CLAUDE.local.md",
        CLAUDE / "AGENTS.md",
        HOME / "AGENTS.md",
    ]
    for d in [CLAUDE / "memory", CLAUDE / "host-rules", CLAUDE / "rules"]:
        if d.exists():
            candidates += sorted(d.rglob("*.md"))
    # project-level
    if project:
        candidates.append(project / "CLAUDE.md")
        rules = project / ".claude" / "rules"
        if rules.exists():
            candidates += sorted(rules.rglob("*.md"))
        agents = project / "AGENTS.md"
        candidates.append(agents)

    total = 0
    seen = set()
    for p in candidates:
        if not p or p in seen or not p.exists() or not p.is_file():
            continue
        seen.add(p)
        text = read_text(p)
        tok = est_tokens(text)
        total += tok
        scope = "global" if str(p).startswith(str(CLAUDE)) else "project"
        entry = {
            "path": str(p).replace(str(HOME), "~"),
            "scope": scope,
            "tokens": tok,
            "lines": text.count("\n") + 1,
        }
        if p.name in ("CLAUDE.md", "CLAUDE.local.md"):
            target = _pointer_target(text)
            if target:
                entry["pointer_to"] = target
        files.append(entry)

    organization = {
        "global_claude_is_pointer": any(
            f["scope"] == "global" and "CLAUDE" in Path(f["path"]).name and "pointer_to" in f
            for f in files
        ),
        "project_claude_is_pointer": any(
            f["scope"] == "project" and Path(f["path"]).name == "CLAUDE.md" and "pointer_to" in f
            for f in files
        ),
        "uses_agents_md": any("AGENTS.md" in f["path"] for f in files)
        or (bool(project) and (project / "AGENTS.md").exists()),
        "uses_rules_dir": any("/rules/" in f["path"] or "\\rules\\" in f["path"] for f in files),
    }
    return {"total_tokens": total, "files": files, "organization": organization}


# endregion

# region harness config (settings / statusline / hooks / permissions)


def scan_settings(project: Path) -> dict:
    def summarize(p: Path, scope: str):
        data = load_json(p)
        if data is None:
            return None
        perms = data.get("permissions", {}) or {}
        return {
            "path": str(p).replace(str(HOME), "~"),
            "scope": scope,
            "has_statusline": "statusLine" in data,
            "statusline_type": (data.get("statusLine") or {}).get("type")
            if isinstance(data.get("statusLine"), dict)
            else None,
            "model": data.get("model"),
            "default_mode": perms.get("defaultMode") or data.get("defaultMode"),
            "env_keys": sorted((data.get("env") or {}).keys()),
            "hook_events": sorted((data.get("hooks") or {}).keys()),
            "permission_allow": len(perms.get("allow", []) or []),
            "permission_deny": len(perms.get("deny", []) or []),
            "output_style": data.get("outputStyle"),
        }

    out = []
    for p, scope in [
        (CLAUDE / "settings.json", "global"),
        (CLAUDE / "settings.local.json", "global-local"),
    ]:
        s = summarize(p, scope)
        if s:
            out.append(s)
    if project:
        for p, scope in [
            (project / ".claude" / "settings.json", "project"),
            (project / ".claude" / "settings.local.json", "project-local"),
        ]:
            s = summarize(p, scope)
            if s:
                out.append(s)
    return {"files": out, "any_statusline": any(s["has_statusline"] for s in out)}


# endregion

# region tools + mcp


TOOLS = [
    "git", "gh", "jq", "rg", "uv", "python3", "node", "bun", "npm",
    "te", "fab", "pbir", "tmdl", "pac", "az", "tmux", "op",
]


def scan_tools() -> dict:
    found = {t: bool(shutil.which(t)) for t in TOOLS}
    return {"on_path": {t: v for t, v in found.items() if v},
            "missing": [t for t, v in found.items() if not v]}


def _installed_apps() -> list:
    """macOS .app bundle names (lowercased) from the usual app dirs."""
    names = []
    for d in [Path("/Applications"), HOME / "Applications"]:
        try:
            if d.exists():
                names += [p.stem.lower() for p in d.iterdir() if p.suffix == ".app"]
        except Exception:
            pass
    return names


STT_APP_MARKERS = ["wispr", "superwhisper", "macwhisper", "talon", "whisper", "aqua"]
STT_CLIS = ["wispr", "whisper", "whisper-cpp", "superwhisper"]
LOCAL_HARNESS_CLIS = ["opencode", "pi", "ollama", "aider", "goose", "crush", "lms", "llamafile", "llama-cli", "mlx_lm", "jan"]
LOCAL_HARNESS_APPS = ["lm studio", "jan", "ollama", "msty", "gpt4all"]


def scan_input_methods() -> dict:
    apps = _installed_apps()
    stt_apps = sorted({m for m in STT_APP_MARKERS if any(m in a for a in apps)})
    stt_clis = sorted({c for c in STT_CLIS if shutil.which(c)})
    return {
        "stt_apps": stt_apps,
        "stt_clis": stt_clis,
        "has_stt": bool(stt_apps or stt_clis),
    }


def scan_alternatives() -> dict:
    apps = _installed_apps()
    harness_clis = sorted({c for c in LOCAL_HARNESS_CLIS if shutil.which(c)})
    local_apps = sorted({m for m in LOCAL_HARNESS_APPS if any(m in a for a in apps)})
    return {
        "local_harness_clis": harness_clis,
        "local_model_apps": local_apps,
        "explores_local_or_oss": bool(harness_clis or local_apps),
    }


def scan_mcp(project: Path) -> dict:
    servers = {}
    # global config
    for p in [HOME / ".claude.json", CLAUDE / "settings.json", CLAUDE / "settings.local.json"]:
        data = load_json(p)
        if isinstance(data, dict):
            for name in (data.get("mcpServers") or {}).keys():
                servers[name] = "global"
    # project config
    if project:
        for p in [project / ".mcp.json", project / ".claude" / "settings.json"]:
            data = load_json(p)
            if isinstance(data, dict):
                for name in (data.get("mcpServers") or {}).keys():
                    servers[name] = "project"
    return {"servers": servers, "count": len(servers)}


# endregion

# region git logging


def scan_git(project: Path) -> dict:
    if not project or not git(["rev-parse", "--is-inside-work-tree"], project):
        return {"is_repo": False}
    remote = git(["remote", "get-url", "origin"], project)
    host = "none"
    if "github.com" in remote:
        host = "github"
    elif "dev.azure.com" in remote or "visualstudio.com" in remote:
        host = "ado"
    elif remote:
        host = "other"
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"], project)
    status = git(["status", "--porcelain"], project)
    ahead_behind = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"], project)
    last_commit = git(["log", "-1", "--format=%cr"], project)
    tags = git(["tag"], project)
    return {
        "is_repo": True,
        "remote_host": host,
        "branch": branch,
        "dirty_files": len([l for l in status.splitlines() if l.strip()]),
        "ahead_behind": ahead_behind,
        "last_commit_relative": last_commit,
        "tag_count": len([t for t in tags.splitlines() if t.strip()]),
    }


# endregion

# region transcripts / usage


def scan_transcripts() -> dict:
    proj = CLAUDE / "projects"
    if not proj.exists():
        return {"available": False}
    jsonls = list(proj.rglob("*.jsonl"))
    total_bytes = 0
    for f in jsonls:
        try:
            total_bytes += f.stat().st_size
        except Exception:
            pass
    return {
        "available": True,
        "project_dirs": len([d for d in proj.iterdir() if d.is_dir()]),
        "session_count": len(jsonls),
        "total_mb": round(total_bytes / 1_048_576, 1),
    }


# endregion

# region other agentic clients (Claude Desktop, VS Code, Cursor, Zed)


def _appsupport() -> Path:
    """Best-effort per-OS app-config root."""
    if sys.platform == "darwin":
        return HOME / "Library" / "Application Support"
    if sys.platform.startswith("win"):
        return Path(os.environ.get("APPDATA", HOME / "AppData" / "Roaming"))
    return HOME / ".config"


def _mcp_names(data) -> list:
    if not isinstance(data, dict):
        return []
    for key in ("mcpServers", "context_servers", "servers"):
        block = data.get(key)
        if isinstance(block, dict):
            return sorted(block.keys())
    # VS Code nests MCP under "mcp": {"servers": {...}}
    mcp = data.get("mcp")
    if isinstance(mcp, dict) and isinstance(mcp.get("servers"), dict):
        return sorted(mcp["servers"].keys())
    return []


def scan_clients(project: Path) -> dict:
    appsup = _appsupport()
    clients = {}

    def record(name, config_paths, rule_paths=None):
        found_cfg = [p for p in config_paths if p and p.exists()]
        servers = {}
        for p in found_cfg:
            for s in _mcp_names(load_json(p)):
                servers[s] = str(p).replace(str(HOME), "~")
        rules = [str(p).replace(str(HOME), "~") for p in (rule_paths or []) if p and p.exists()]
        clients[name] = {
            "installed": bool(found_cfg or rules),
            "config_files": [str(p).replace(str(HOME), "~") for p in found_cfg],
            "mcp_servers": servers,
            "rule_files": rules,
        }

    # Claude Desktop
    record(
        "claude-desktop",
        [appsup / "Claude" / "claude_desktop_config.json"],
    )
    # Cursor
    record(
        "cursor",
        [HOME / ".cursor" / "mcp.json",
         (project / ".cursor" / "mcp.json") if project else None,
         appsup / "Cursor" / "User" / "settings.json"],
        rule_paths=[(project / ".cursorrules") if project else None]
        + (sorted((project / ".cursor" / "rules").rglob("*.mdc")) if project and (project / ".cursor" / "rules").exists() else []),
    )
    # VS Code (MCP + Copilot instructions)
    record(
        "vscode",
        [appsup / "Code" / "User" / "mcp.json",
         appsup / "Code" / "User" / "settings.json",
         (project / ".vscode" / "mcp.json") if project else None],
        rule_paths=[(project / ".github" / "copilot-instructions.md") if project else None],
    )
    # Zed
    record(
        "zed",
        [HOME / ".config" / "zed" / "settings.json"],
    )
    return clients


# endregion

# region execution environment (bare metal vs VM / container)


def scan_environment() -> dict:
    indicators = []
    container = False
    if Path("/.dockerenv").exists():
        container = True
        indicators.append("/.dockerenv")
    try:
        cg = Path("/proc/1/cgroup")
        if cg.exists():
            t = cg.read_text(errors="replace")
            for marker in ("docker", "containerd", "kubepods", "lxc", "podman"):
                if marker in t:
                    container = True
                    indicators.append(f"cgroup:{marker}")
                    break
    except Exception:
        pass
    for ev in ("KUBERNETES_SERVICE_HOST", "container", "DEVCONTAINER"):
        if os.environ.get(ev):
            container = True
            indicators.append(f"env:{ev}")

    virt = "unknown"
    try:
        if sys.platform.startswith("linux") and shutil.which("systemd-detect-virt"):
            out = subprocess.run(["systemd-detect-virt"], capture_output=True, text=True, timeout=4)
            v = out.stdout.strip()
            if v and v != "none":
                virt = v
                indicators.append(f"virt:{v}")
            elif v == "none":
                virt = "bare-metal"
        elif sys.platform == "darwin":
            out = subprocess.run(["sysctl", "-n", "kern.hv_vmm_present"], capture_output=True, text=True, timeout=4)
            if out.stdout.strip() == "1":
                virt = "vm-guest"
                indicators.append("darwin:hv_vmm_present")
            elif out.stdout.strip() == "0":
                virt = "bare-metal"
    except Exception:
        pass

    try:
        import getpass
        user = getpass.getuser()
    except Exception:
        user = os.environ.get("USER") or os.environ.get("USERNAME") or "unknown"

    if container:
        degree = "container"
    elif virt not in ("unknown", "bare-metal"):
        degree = "vm"
    elif virt == "bare-metal":
        degree = "bare-metal"
    else:
        degree = "unknown"

    return {
        "is_container": container,
        "virtualization": virt,
        "isolated": container or virt not in ("unknown", "bare-metal"),
        "isolation_degree": degree,
        "os_user": user,
        "indicators": indicators,
    }


# endregion

# region safety-by-instruction (declared vs enforced)


SAFETY_RULES = {
    "exfiltration": re.compile(r"(?i)\bnever\b.{0,40}\bexfiltrat"),
    "secrets": re.compile(r"(?i)\bnever\b.{0,40}\b(?:secret|token|credential|password|api[-_ ]?key)"),
    "deletion": re.compile(r"(?i)\bnever\b.{0,30}\b(?:rm -rf|delete|destroy|discard|drop)"),
    "git-main": re.compile(r"(?i)\bnever\b.{0,40}\b(?:push|commit|merge)\b.{0,20}\b(?:main|master|force)"),
    "install": re.compile(r"(?i)\bnever\b.{0,30}\binstall"),
    "bypass": re.compile(r"(?i)\bnever\b.{0,40}\b(?:bypass|route around|work around|circumvent)"),
}


def scan_safety_instructions(memory_files) -> dict:
    """Count declared 'never X' safety rules across memory files. These are
    non-binding suggestions to the model unless a hook or the environment
    actually enforces them; the report cross-references enforcement."""
    samples = []
    by_cat = {k: 0 for k in SAFETY_RULES}
    for entry in memory_files:
        p = Path(entry["path"].replace("~", str(HOME)))
        if not p.exists():
            continue
        for i, line in enumerate(read_text(p).splitlines(), 1):
            if len(line) > 600:
                continue
            for cat, rx in SAFETY_RULES.items():
                if rx.search(line):
                    by_cat[cat] += 1
                    if len(samples) < 30:
                        samples.append({
                            "path": entry["path"], "line": i, "category": cat,
                            "text": line.strip()[:160],
                        })
                    break
    return {
        "count": sum(by_cat.values()),
        "by_category": {k: v for k, v in by_cat.items() if v},
        "samples": samples,
        "note": "declared rules; non-binding unless a hook or the environment enforces them",
    }


# endregion

# region guards (permission mode, supply-chain install blocks, secret-read blocks)


GUARD_KEYWORDS = {
    "release-age-guard": re.compile(r"(?i)release[-_ ]?age|\b48\s*h(?:ours?)?\b|age[-_]?guard|days?[-_]?old"),
    "install-guard": re.compile(r"(?i)\b(?:npm|bun|pnpm|yarn|pip|uv|cargo|gem)\b.*\b(?:install|add)\b|instead[-_]of[-_]bun"),
    "secret-read-block": re.compile(r"(?i)\bop\s+read\b|op[-_]read|read[-_]?block"),
}


def _hook_command_strings(data) -> list:
    """Flatten every hook command string from a settings hooks block."""
    cmds = []
    hooks = data.get("hooks") if isinstance(data, dict) else None
    if not isinstance(hooks, dict):
        return cmds
    for _event, matchers in hooks.items():
        if not isinstance(matchers, list):
            continue
        for m in matchers:
            for h in (m or {}).get("hooks", []) or []:
                c = h.get("command")
                if isinstance(c, str):
                    cmds.append(c)
    return cmds


def scan_guards(project: Path) -> dict:
    files = [
        CLAUDE / "settings.json",
        CLAUDE / "settings.local.json",
    ]
    if project:
        files += [project / ".claude" / "settings.json",
                  project / ".claude" / "settings.local.json"]

    default_mode = None
    all_cmds = []
    for p in files:
        data = load_json(p)
        if not isinstance(data, dict):
            continue
        dm = (data.get("permissions") or {}).get("defaultMode") or data.get("defaultMode")
        if dm and not default_mode:
            default_mode = dm
        all_cmds += _hook_command_strings(data)

    matched = {name: 0 for name in GUARD_KEYWORDS}
    for c in all_cmds:
        for name, rx in GUARD_KEYWORDS.items():
            if rx.search(c):
                matched[name] += 1

    return {
        "default_mode": default_mode,
        "hook_command_count": len(all_cmds),
        "release_age_guard": bool(matched["release-age-guard"] or matched["install-guard"]),
        "secret_read_block": bool(matched["secret-read-block"]),
        "match_counts": {k: v for k, v in matched.items() if v},
    }


# endregion

# region network exposure + uncontainerized autonomous agents


MESH_VPN_CLIS = ["tailscale", "wg", "wg-quick", "zerotier-cli", "nebula", "netbird", "headscale"]
# known / user-named autonomous agent runtimes that are a risk when run uncontainerized
# on a primary machine; the list is illustrative, not exhaustive
AUTONOMOUS_AGENT_MARKERS = [
    "openclaw", "hermes", "microsoft-spark", "ms-spark",
    "autogpt", "auto-gpt", "babyagi", "agentgpt", "superagi", "crewai",
    "autogen", "devika", "openhands", "gpt-engineer",
]


def _listening_sockets():
    """Non-loopback TCP listeners: (bind_addr, port, process). Best-effort, deep scope only."""
    rows = []
    try:
        if sys.platform == "darwin" or sys.platform.startswith("linux"):
            out = subprocess.run(
                ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"],
                capture_output=True, text=True, timeout=8,
            )
            for line in out.stdout.splitlines()[1:]:
                parts = line.split()
                if len(parts) < 9:
                    continue
                proc = parts[0]
                name = parts[8]
                if "->" in name or ":" not in name:
                    continue
                addr, _, port = name.rpartition(":")
                addr = addr.strip("[]")
                loopback = addr in ("127.0.0.1", "::1", "localhost")
                if not loopback:
                    rows.append({"bind": addr, "port": port, "process": proc})
    except Exception:
        pass
    # dedupe
    seen, uniq = set(), []
    for r in rows:
        k = (r["bind"], r["port"], r["process"])
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq


def scan_network(scope: str) -> dict:
    mesh = sorted({c for c in MESH_VPN_CLIS if shutil.which(c)})
    tailscale_up = None
    if shutil.which("tailscale"):
        try:
            out = subprocess.run(["tailscale", "status"], capture_output=True, text=True, timeout=6)
            tailscale_up = out.returncode == 0 and "Logged out" not in out.stdout
        except Exception:
            tailscale_up = None
    result = {"mesh_vpn_clis": mesh, "tailscale_up": tailscale_up}
    if scope == "deep":
        exposed = _listening_sockets()
        wildcard = [r for r in exposed if r["bind"] in ("0.0.0.0", "*", "::")]
        result["exposed_listeners"] = exposed
        result["wildcard_bind_count"] = len(wildcard)
        result["exposed_checked"] = True
    else:
        result["exposed_checked"] = False
    return result


def scan_autonomous_agents(scope: str) -> dict:
    found = {}
    for m in AUTONOMOUS_AGENT_MARKERS:
        if shutil.which(m):
            found[m] = "on-path"
    apps = _installed_apps()
    for m in AUTONOMOUS_AGENT_MARKERS:
        if any(m.replace("-", "") in a.replace(" ", "").replace("-", "") for a in apps):
            found.setdefault(m, "app")
    if scope == "deep":
        try:
            out = subprocess.run(["ps", "-Ao", "comm="], capture_output=True, text=True, timeout=6)
            running = out.stdout.lower()
            for m in AUTONOMOUS_AGENT_MARKERS:
                if m in running:
                    found[m] = "running"
        except Exception:
            pass
    return {
        "found": found,
        "any": bool(found),
        "process_checked": scope == "deep",
        "note": "illustrative marker list; uncontainerized autonomous agents on a primary machine are the risk",
    }


# endregion

# region secrets / PII hygiene


SECRET_RULES = [
    ("private-key-block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{30,}\b")),
    ("github-pat", re.compile(r"\bgithub_pat_[0-9A-Za-z_]{40,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("bearer-jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
    ("conn-string-password", re.compile(r"(?i)(?:password|pwd)\s*=\s*[^;\s'\"]{6,}")),
    ("assigned-secret", re.compile(
        r"(?i)(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|client[_-]?secret|passwd|password)"
        r"\s*[:=]\s*['\"]?[A-Za-z0-9_\-/+=]{16,}")),
]
# credit-card-like and US-SSN-like; PII signals, kept separate because they're noisier
PII_RULES = [
    ("card-like", re.compile(r"\b(?:\d[ -]?){13,16}\b")),
    ("ssn-like", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
]
SKIP_DIRS = {".git", "node_modules", "target", "dist", "build", "__pycache__",
             ".venv", "venv", ".mypy_cache", ".ruff_cache", "obj", "bin"}
TEXT_EXT = {".md", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".env", ".ini",
            ".cfg", ".conf", ".toml", ".ps1", ".sh", ".py", ".js", ".ts", ".xml"}
MAX_FILES = {"user": 4000, "project": 8000, "deep": 40000}
MAX_BYTES = 1_048_576


def _is_probably_placeholder(line: str) -> bool:
    low = line.lower()
    return any(m in low for m in ("example", "placeholder", "your-", "xxxx", "<", "dummy", "changeme", "op://", "$(", "${"))


def _scan_file_secrets(p: Path, include_pii: bool = False) -> list:
    findings = []
    try:
        if p.stat().st_size > MAX_BYTES:
            return findings
        raw = p.read_bytes()
        if b"\x00" in raw[:2048]:
            return findings
        text = raw.decode("utf-8", errors="replace")
    except Exception:
        return findings
    for i, line in enumerate(text.splitlines(), 1):
        if len(line) > 4000:
            continue
        hit = False
        for name, rx in SECRET_RULES:
            m = rx.search(line)
            if m and not _is_probably_placeholder(line):
                findings.append({
                    "path": str(p).replace(str(HOME), "~"),
                    "line": i, "rule": name,
                    "match_len": len(m.group(0)), "kind": "secret",
                })
                hit = True
                break  # one finding per line is enough
        if hit or not include_pii:
            continue
        for name, rx in PII_RULES:
            m = rx.search(line)
            if m:
                findings.append({
                    "path": str(p).replace(str(HOME), "~"),
                    "line": i, "rule": name,
                    "match_len": len(m.group(0)), "kind": "pii",
                })
                break
    return findings


def _iter_files(root: Path, cap: int):
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".") or d in {".claude", ".github", ".vscode", ".cursor"}]
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix.lower() in TEXT_EXT or fn.startswith(".env"):
                yield p
                count += 1
                if count >= cap:
                    return


def scan_secrets(project: Path, scope: str) -> dict:
    cap = MAX_FILES.get(scope, MAX_FILES["user"])
    roots = []
    if scope in ("user", "deep"):
        for d in [CLAUDE / "memory", CLAUDE / "host-rules"]:
            if d.exists():
                roots.append(d)
        for f in [CLAUDE / "settings.json", CLAUDE / "settings.local.json",
                  CLAUDE / "CLAUDE.md", HOME / ".claude.json"]:
            if f.exists():
                roots.append(f)
    if scope in ("project", "deep") and project:
        roots.append(project)
    if scope == "deep":
        # config-heavy dotfile dirs where secrets hide, without walking all of $HOME
        for d in [HOME / ".config", HOME / ".aws", HOME / ".azure", HOME / ".ssh"]:
            if d.exists():
                roots.append(d)

    include_pii = scope == "deep"
    findings = []
    scanned = 0
    for root in roots:
        if root.is_file():
            findings += _scan_file_secrets(root, include_pii)
            scanned += 1
        else:
            for p in _iter_files(root, cap):
                findings += _scan_file_secrets(p, include_pii)
                scanned += 1
                if scanned >= cap:
                    break

    # .env inventory + git exposure (project scope)
    env_files = []
    if project and project.exists():
        for envp in list(project.rglob(".env")) + list(project.rglob(".env.*")):
            if any(part in SKIP_DIRS for part in envp.parts):
                continue
            tracked = bool(git(["ls-files", "--error-unmatch", str(envp)], project))
            ignored = bool(git(["check-ignore", str(envp)], project))
            env_files.append({
                "path": str(envp).replace(str(HOME), "~"),
                "git_tracked": tracked,
                "gitignored": ignored,
            })

    return {
        "scope": scope,
        "files_scanned": scanned,
        "capped": scanned >= cap,
        "secret_hits": findings,
        "secret_count": len(findings),
        "env_files": env_files,
        "note": "locations only; no secret values are ever emitted",
    }


# endregion


def main():
    scope = "user"
    positional = []
    for a in sys.argv[1:]:
        if a.startswith("--scope="):
            scope = a.split("=", 1)[1].strip().lower()
        else:
            positional.append(a)
    if scope not in ("user", "project", "deep"):
        scope = "user"

    if positional:
        project = Path(positional[0]).expanduser().resolve()
    else:
        cwd = Path.cwd()
        top = git(["rev-parse", "--show-toplevel"], cwd)
        project = Path(top) if top else cwd

    os_name = {"darwin": "macOS", "win32": "Windows"}.get(sys.platform, "Linux")
    report = {
        "home": str(HOME),
        "os": os_name,
        "project": str(project) if project else None,
        "scope": scope,
        "skills": scan_skills(),
        "memory": (memory := scan_memory(project)),
        "settings": scan_settings(project),
        "tools": scan_tools(),
        "input_methods": scan_input_methods(),
        "alternatives": scan_alternatives(),
        "mcp": scan_mcp(project),
        "git": scan_git(project),
        "transcripts": scan_transcripts(),
        "clients": scan_clients(project),
        "environment": scan_environment(),
        "network": scan_network(scope),
        "autonomous_agents": scan_autonomous_agents(scope),
        "guards": scan_guards(project),
        "safety_instructions": scan_safety_instructions(memory["files"]),
        "secrets": scan_secrets(project, scope),
    }
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
