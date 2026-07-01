---
name: setup-agentic-dev
version: 26.25
description: Prescriptive setup workflow for agentic Power BI and Fabric development; the getting-started guide for this marketplace. Use whenever someone is onboarding, setting up a new machine, or asks what to install or which prerequisites they need for these plugins; e.g. "how do I get started", "set up my environment for Power BI agentic dev", "what do I need to install for the reports / semantic-models / fabric-cli plugin", "install the Fabric CLI / te / pbir on Windows or Mac", "prerequisites", "onboarding". Covers Windows and macOS install commands, authentication, and verification for every external tool the marketplace's plugins depend on. Route here for installing tools and setting up the environment, not for using them (the domain skills cover usage).
---

# Set up agentic Power BI and Fabric development

A prescriptive workflow to get a machine ready to work these plugins. It maps each plugin to the external tools it needs, gives Windows and macOS install commands for each tool, and ends with authentication and a verification pass.

The guiding principle, echoed in the marketplace README: install only what the task needs. Each installed tool and skill competes for the agent's attention and context. Install the small base layer everyone shares, then add the tools for the plugins actually in use; skip the rest.

## How to use this skill

1. Confirm the target OS (Windows or macOS) and whether the user drives Power BI Desktop locally, since that decides several Windows-only paths
2. Install the base layer (everyone needs it); see `references/foundation.md`
3. Look up the plugins in the map below, collect the union of tools, and install them from the matching reference file
4. Authenticate the cloud tools and any MCP servers
5. Run the verification pass at the end of this file

Do not install tools the user has no plugin for. If unsure which plugins they want, ask before installing anything beyond the base layer.

## The base layer (everyone)

Install once regardless of which plugins follow. Details and commands: `references/foundation.md`.

```
coding agent      Claude Code CLI (or GitHub Copilot CLI) + add this marketplace
uv                Python tool installer and runner; how most CLIs here install
git               required; on Windows also enable long paths (repo has long TMDL paths)
python 3.10+      most helper scripts run under uv / python3
shared CLIs       jq (nearly every hook + script), plus gh and ripgrep where noted
```

## Plugin to tool map

Each block lists what a plugin needs beyond the base layer. `windows-only` means there is no native macOS path (on a Mac, run it inside a Windows VM). `optional` means the plugin degrades gracefully without it. The `install:` line points to the reference file with the commands.

One stance to carry into these choices: for any model change, work down this cascade and stop at the first tool that is available.

```
te CLI  >  Power BI Modeling MCP  >  connect-pbid (live TOM/ADOMD)  >  hand-authored TMDL
```

`te` is the default because it drives changes through a validated API and keeps the model consistent; an MCP server is the next best. The `pbi-desktop` / `connect-pbid` path (TOM and ADOMD.NET over PowerShell) is a fallback for when no CLI or MCP is available; it is also the tool for querying and tracing a live local model. Hand-authoring TMDL is the last resort: it is manual text surgery, the easiest way to leave the model inconsistent. Directly modifying model metadata is not recommended as a habit; prefer the validated tools at the top of the cascade and descend only when you must. That is why the connect-pbid stack and hand-authored TMDL show up as `optional` / last-resort below.

```yaml
tabular-editor:
  needs: [te CLI]
  windows-only: [TabularEditor.exe (TE2)]        # Mac: Windows VM only
  install: references/models.md

pbi-desktop:                                     # fallback path; skip it if you use te or an MCP
  needs: [Power BI Desktop, PowerShell, NuGet CLI, TOM + ADOMD.NET NuGet packages, jq]
  optional: [.NET 8 SDK (daxlib model ops), gh (daxlib registry), Parallels Desktop (Mac -> Windows VM)]
  note: Windows-only, runs against a live local model; good for querying and tracing
  model-edits: fallback only; prefer te then an MCP. Live TOM outranks hand-authored TMDL, below both tools
  install: references/models.md

pbip:
  needs: [pbir CLI, jq]
  bundled: [tmdl-validate binary (ships in the plugin; no install)]
  optional: [Gemini API deps (google-genai, pillow, keyring) for AI report backgrounds]
  install: references/reports-and-visuals.md   # pbir CLI + Gemini; tmdl-validate is bundled

semantic-models:
  needs: [te CLI, fab (Fabric CLI), az (Azure CLI)]   # te is the primary path for every model change
  optional: [pbir CLI (rename propagation), Power BI Modeling MCP, connect-pbid/TOM (fallback)]
  change-order: te > MCP > connect-pbid > hand-authored TMDL (last resort)
  python: [requests, azure-identity, pyarrow]    # auto-installed via uv run --with
  install: references/models.md   # te + local model tools; fab/az live in references/fabric.md

reports:
  needs: [pbir CLI, fab, az, jq]
  optional: [DAX Studio or Power BI Desktop (local thick-report DAX via ADOMD.NET), gh, Chrome MCP (Mac verify)]
  python: [requests]
  install: references/reports-and-visuals.md

custom-visuals:
  needs: [Node.js 20.19+, pbiviz (powerbi-visuals-tools), pbir CLI]
  by-skill:
    python-visuals: [Python 3.11 runtime + matplotlib/seaborn locally]
    r-visuals: [R runtime (4.3.3 matches the Service)]
    svg-visuals: [a model-editing path (te > MCP > connect-pbid > TMDL) + daxlib packages]
  mcp: [pbiviz MCP (npx powerbi-visuals-tools mcp)]
  install: references/reports-and-visuals.md

paginated-reports:
  needs: [az, curl, jq, python3]
  optional: [Power BI Report Builder (Windows GUI), Power BI Report Server (local render)]
  capacity: publish/render needs Premium / Embedded / Fabric capacity (shared won't render)
  install: references/reports-and-visuals.md

fabric-cli:
  needs: [fab (Fabric CLI), az (Azure CLI)]
  optional: [DuckDB (lakehouse queries), sqlcmd (SQL endpoint), nb (notebooks), az microsoft-fabric extension]
  mcp: [microsoft-learn (public), fabric-sql (needs FABRIC_PBI_TOKEN)]
  install: references/fabric.md

fabric-admin:
  needs: [fab (admin account), az (with Graph permissions)]
  requires: fabric-cli plugin installed
  python: [pyyaml, reportlab]                     # auto-installed via uv run
  install: references/fabric.md

etl:
  needs: [fab, az, DuckDB]
  capacity: Spark/Livy needs Fabric capacity (F SKU or trial) + a lakehouse
  install: references/fabric.md
```

## Reference files

Read the file that matches the plugins in scope. Each is self-contained with Windows + macOS commands, auth, and prerequisites.

```
references/foundation.md            Base layer everyone needs: coding agent + marketplace,
                                    uv, git + Windows long paths, Python, Node/bun, shared
                                    CLIs (jq, gh, ripgrep), and the auth + verify overview

references/fabric.md                Cloud and service tools: fab, az (+ microsoft-fabric),
                                    the MCP servers and their tokens, DuckDB, sqlcmd, nb,
                                    Spark/Livy. For fabric-cli, fabric-admin, etl, and the
                                    cloud operations of semantic-models and reports

references/models.md                Semantic model tools: te CLI, TE2, Power BI
                                    Desktop + PowerShell + TOM/ADOMD.NET (NuGet) + .NET 8,
                                    daxlib, the bundled tmdl-validate, and Mac-via-Parallels.
                                    For tabular-editor, pbi-desktop, pbip (TMDL), semantic-models

references/reports-and-visuals.md   Report and visual tools: pbir CLI (+ Desktop bridge and
                                    local DAX), pbiviz + Node, R and Python visual runtimes,
                                    the Gemini background script, and paginated report tooling.
                                    For reports, custom-visuals, paginated-reports, pbip (PBIR)
```

## Authentication summary

Most cloud tools authenticate independently even when they share an identity, so log in to each one you installed. Full commands live in the reference files; this is the checklist.

```
fab auth login          Fabric CLI; check with `fab auth status`. Works on Pro, PPU, or Fabric
az login                Azure CLI; underpins tokens for DuckDB, sqlcmd, Livy, pbir usage, lineage
te auth login           Tabular Editor CLI; browser login cached. CI uses --auth env + SPN vars
FABRIC_PBI_TOKEN        env var for the fabric-sql MCP; export a bearer token before launching
                        the agent (OAuth over /mcp does not work). Expires ~1h; re-export + restart
```

Cloud model deploy/refresh and XMLA write need a capable SKU (Premium, PPU, Fabric, or Trial). The Fabric CLI itself and read paths work on plain Pro.

## Verification pass

Run the checks for the tools that were installed. A missing or erroring command is where setup broke.

```bash
# Base layer
claude --version            # or: copilot --version
uv --version
git --version
python3 --version

# Cloud / Fabric
fab --version && fab auth status
az version && az account show

# Semantic models
te --version && te auth status

# Reports / visuals
pbir --version
node --version              # if custom-visuals is in use

# Data / query (fabric-cli, etl)
duckdb --version
sqlcmd --version

# Shared / local-model helpers
jq --version
gh --version                # optional
dotnet --version            # if daxlib model ops are used (pbi-desktop)
pwsh --version              # PowerShell 7, or use Windows PowerShell for connect-pbid
```

On Windows, also confirm long paths are enabled if `git clone` of the marketplace failed:

```powershell
git config --system --get core.longpaths     # should print: true
```

If any tool is missing, return to its reference file and install it. If a cloud command errors on auth, re-run the matching login from the authentication summary.
