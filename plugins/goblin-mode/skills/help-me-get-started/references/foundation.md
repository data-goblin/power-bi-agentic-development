# Foundation: the base layer

Install this before the domain tools, and only what the user's plugins need. Windows commands use [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) in PowerShell, macOS uses [Homebrew](https://brew.sh), Linux uses the distribution's package manager (Arch commands below; Debian and Ubuntu use `apt` with the same package names unless noted). The user is already inside Claude Code, so the agent itself is not installed here.

## 1. Add the marketplace

```bash
claude plugin marketplace add data-goblin/power-bi-agentic-development
claude plugin install fabric-cli@power-bi-agentic-development      # repeat per plugin, or use /plugin
```

Check with `claude --version` and `claude doctor`. GitHub Copilot CLI reads the same manifest (`copilot plugin marketplace add ...`); hooks need Copilot CLI 1.0.26 or newer.

## 2. git and Windows long paths

```bash
winget install Git.Git            # Windows
brew install git                  # macOS
sudo pacman -S git                # Arch
sudo apt install git              # Debian, Ubuntu
```

Windows only: long TMDL paths need long path support in the OS and in git; run the repo's `useful-stuff/agent-scripts/enable-windows-longpaths.ps1` elevated, then reboot. macOS and Linux need nothing.

## 3. uv

Most CLIs and scripts here install or run through [uv](https://docs.astral.sh/uv/) (`uv tool install`, `uv run`, `uv run --with`). Scripts declare their own dependencies in a PEP 723 header; use `uv`, not `pip`.

```bash
winget install --id astral-sh.uv  # Windows
brew install uv                   # macOS
sudo pacman -S uv                 # Arch
```

On Debian or Ubuntu use the standalone installer from https://docs.astral.sh/uv/getting-started/installation/ (download it, read it, then run it). `uv python install 3.12` provides Python when the system one is older than 3.10.

## 4. Node.js and bun (custom-visuals only)

`pbiviz` needs Node.js 20.19 or later. bun is preferred over npm because it skips install scripts by default.

```bash
winget install OpenJS.NodeJS.LTS ; winget install Oven-sh.Bun    # Windows
brew install node bun                                            # macOS
sudo pacman -S nodejs bun                                        # Arch
```

## 5. Shared helpers

`jq` is needed by nearly every hook and script. `gh` (theme schema lookups, daxlib registry) and `rg` (renames) are optional.

```bash
winget install jqlang.jq ; winget install GitHub.cli ; winget install BurntSushi.ripgrep.MSVC   # Windows
brew install jq gh ripgrep                                                                      # macOS
sudo pacman -S jq github-cli ripgrep                                                            # Arch
sudo apt install jq gh ripgrep                                                                  # Debian, Ubuntu
```

## Tools with no native Linux or macOS build

Power BI Desktop, `TabularEditor.exe` (TE2), the NuGet TOM/ADOMD.NET stack and Windows PowerShell run on Windows only. On a Mac the `pbi-desktop` plugin drives a Windows VM through Parallels (`prlctl` at `/usr/local/bin/prlctl`, shared folders on); see `models.md`. On Linux use the cloud and CLI paths: `te`, `pbir`, `fab`, `az` and DuckDB all run natively on Linux, and `pbi-desktop` has no Linux path.

Next: take the union of tools for the plugins in scope and install them from `fabric.md`, `models.md` and `reports-and-visuals.md`, then run the verification pass in `install.md`.
