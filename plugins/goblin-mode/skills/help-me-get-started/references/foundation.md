# Foundation: the base layer everyone needs

Install this first, on any machine, before the domain tools. Windows commands assume [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (ships with Windows 10/11); run them in PowerShell. macOS commands assume [Homebrew](https://brew.sh); install it first if missing:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 1. The coding agent + this marketplace

Pick one agent. Claude Code is the primary target; GitHub Copilot CLI reads the same marketplace manifest.

### Claude Code CLI

```bash
# macOS (native installer, recommended)
curl -fsSL https://claude.ai/install.sh | bash

# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex

# Either OS, if you already run Node 18+ and prefer npm
npm install -g @anthropic-ai/claude-code
```

Then add the marketplace and install the plugins in scope:

```bash
claude plugin marketplace add data-goblin/power-bi-agentic-development
claude plugin install fabric-cli@power-bi-agentic-development
# ...repeat per plugin, or install interactively with /plugin
```

Verify: `claude --version`, then `claude doctor` to diagnose a broken install.

### GitHub Copilot CLI (alternative)

See the [Copilot CLI docs](https://docs.github.com/en/copilot/how-tos/copilot-cli) for the install. Then either register the marketplace and install a child plugin, or install one plugin straight from its subdirectory:

```bash
copilot plugin marketplace add data-goblin/power-bi-agentic-development
copilot plugin install fabric-cli@power-bi-agentic-development

# or, no marketplace registration:
copilot plugin install data-goblin/power-bi-agentic-development:plugins/pbip
```

Hooks need Copilot CLI 1.0.26 or newer (it sets `CLAUDE_PLUGIN_ROOT`); run `copilot update` if hooks misfire.

## 2. git + Windows long paths

git is required for cloning the marketplace and for the file-based hooks. Install if missing:

```bash
# Windows
winget install Git.Git

# macOS (usually preinstalled via Xcode CLT; otherwise)
brew install git
```

Windows only, and important: this marketplace ships TMDL files whose repo-relative paths exceed the legacy 260-character `MAX_PATH`. Without long-path support, `git clone` (and any plugin install that wraps a clone) aborts with `Filename too long`. Enable it once, from an elevated PowerShell, then reboot:

```powershell
# Registry (OS level) + git (both are needed)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1
git config --system core.longpaths true
```

The repo ships a self-checking, idempotent helper that does exactly this: `useful-stuff/agent-scripts/enable-windows-longpaths.ps1` (run elevated). macOS and Linux have no `MAX_PATH` limit; nothing to do there.

## 3. uv (Python tool installer and runner)

Nearly every CLI and helper script in these plugins installs or runs through [uv](https://docs.astral.sh/uv/): `uv tool install <cli>`, `uv run script.py`, `uv run --with <pkg>` for ephemeral dependencies. Install it first because `fab`, `pbir`, and others depend on it.

```bash
# Windows
winget install --id astral-sh.uv

# macOS
brew install uv

# Either OS, official script fallback
curl -LsSf https://astral.sh/uv/install.sh | sh          # macOS/Linux
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"  # Windows
```

Verify: `uv --version`.

## 4. Python

The helper scripts target Python 3.10+ (report/model scripts) and the Service pins 3.11 for Python visuals. uv can manage Python for you (`uv python install 3.11`), or install it directly:

```bash
# Windows
winget install Python.Python.3.12

# macOS
brew install python@3.12
```

You rarely install Python packages by hand; scripts declare their own dependencies and uv resolves them. When a script asks for one explicitly, use `uv pip install <pkg>` rather than `pip`.

## 5. Node.js and bun (only for custom-visuals)

`pbiviz` and its MCP server need Node.js 20.19 or later. Skip this unless the custom-visuals plugin is in scope.

```bash
# Windows
winget install OpenJS.NodeJS.LTS

# macOS
brew install node
```

The marketplace convention prefers [bun](https://bun.com) over npm for speed and safer installs (bun skips post-install scripts by default). Optional:

```bash
# Windows
winget install Oven-sh.Bun

# macOS
brew install bun
```

Verify: `node --version` (expect 20.19+).

## 6. Shared command-line helpers

Small tools several hooks and scripts rely on. `jq` is the one to install proactively; the others are per-plugin.

```bash
# jq: required by nearly every hook and JSON-handling script
winget install jqlang.jq          # Windows
brew install jq                   # macOS

# gh: GitHub CLI; theme schema lookups, daxlib registry (optional, degrades to curl)
winget install GitHub.cli         # Windows
brew install gh                   # macOS

# ripgrep (rg): fast reference search when renaming model objects (optional)
winget install BurntSushi.ripgrep.MSVC   # Windows
brew install ripgrep                      # macOS
```

`curl` ships with Windows 10+ and macOS, so no install is needed for the scripts that shell out to it.

## Mac via a Windows VM

A few tools have no native macOS build: Power BI Desktop, `TabularEditor.exe` (TE2), the NuGet-based TOM/ADOMD.NET stack, and Windows PowerShell. On a Mac, those run inside a Windows VM. The `pbi-desktop` plugin automates this through [Parallels Desktop](https://www.parallels.com/) and its `prlctl` CLI (expects `prlctl` at `/usr/local/bin/prlctl`, a licensed Windows VM with Power BI Desktop open, and shared folders on so `~` maps to `\\Mac\Home\`). See `references/models.md` for the details.

Everything cloud-facing (`fab`, `az`, `te`, `pbir`, DuckDB, sqlcmd) runs natively on macOS; the VM is only for the local-Desktop path.

## What to do next

Return to `SKILL.md`, take the union of tools for the plugins in scope, and install them from `references/fabric.md`, `references/models.md`, and `references/reports-and-visuals.md`. Then run the verification pass.
