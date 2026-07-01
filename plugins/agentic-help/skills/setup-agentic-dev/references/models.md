# Semantic model tools

For `tabular-editor`, `pbi-desktop`, `pbip` (TMDL), and `semantic-models`. Some of these are Windows-only; on a Mac they run inside a Windows VM (see the Parallels section at the end and in `references/foundation.md`).

## te (Tabular Editor CLI, cross-platform, preview)

The `semantic-models` skills drive every model change through `te` first (add/set measures, relationships, roles, calc groups, `te validate`, `te bpa`, `te vertipaq`, `te query`). It is a single self-contained binary; no runtime to install. The `tabular-editor` plugin owns the install reference.

```powershell
# Windows (PowerShell)
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dir  = "$env:LOCALAPPDATA\Programs\te"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://cdn.tabulareditor.com/files/cli/latest/te-win-$arch.zip" -OutFile "$env:TEMP\te.zip"
Expand-Archive -Force "$env:TEMP\te.zip" -DestinationPath $dir
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path','User'));$dir", 'User')
& "$dir\te.exe" --version
```

```bash
# macOS / Linux
os=$(uname -s | tr 'A-Z' 'a-z'); [ "$os" = darwin ] && os=osx
arch=$(uname -m); case "$arch" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; esac
mkdir -p "$HOME/.local/bin"
curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-$os-$arch.tar.gz" | tar xz -C "$HOME/.local/bin" te
chmod +x "$HOME/.local/bin/te"
export PATH="$HOME/.local/bin:$PATH"   # add to ~/.zshrc or ~/.bashrc to persist
te --version
```

Authenticate with `te auth login` (browser, cached); check `te auth status`. CI or unattended runs use `te --auth env` with `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID`. Self-update with `te --update`; share a session across calls with `TE_SESSION=<name>`.

Two caveats worth stating up front: cloud deploy/refresh/query needs an XMLA-write-capable SKU (Premium, PPU, Fabric, or Trial); `fab import` is the non-XMLA fallback. And this is a limited public preview whose builds stop working after 2026-09-30, with no license required during preview.

## TabularEditor.exe (TE2, Windows-only)

Free, Windows-only. Used by the `te2-cli` and `c-sharp-scripting` skills for deployment, C# scripting, and BPA in existing Windows pipelines.

```powershell
# Windows: download and extract from releases, or use Chocolatey
choco install tabulareditor2
```

Releases: [github.com/TabularEditor/TabularEditor/releases](https://github.com/TabularEditor/TabularEditor/releases). There is no native macOS build; on a Mac, run it inside a Windows VM. Auth uses Windows integrated auth by default, or a service principal via the same `AZURE_*` env vars, or an MSOLAP connection string.

## pbi-search (docs search, optional)

Powers the `te-docs` skill; searches Tabular Editor docs, DAX.guide, SQLBI, Microsoft Learn, and more. Same commands on Windows and macOS.

```bash
# From source (recommended; needs the Rust toolchain, https://rustup.rs)
cargo install --git https://github.com/data-goblin/pbi-search
pbi-search sync

# Or download a prebuilt binary and put it on PATH
#   https://github.com/data-goblin/pbi-search/releases
```

Run `pbi-search sync` once to build the cache (add `--descriptions` for a richer index). Verify: `pbi-search --version`. If it is not installed, the skill falls back to the microsoft-learn MCP or `WebFetch`.

## Power BI Desktop (Windows-only)

Required by the whole `pbi-desktop` plugin (connect to a live local model) and the local paths of `pbir` and `semantic-models`.

```powershell
# Windows: winget or the Microsoft Store
winget install Microsoft.PowerBI
```

There is no macOS build; on a Mac it runs inside a Windows VM. For the Desktop Bridge and `pbir desktop` features, enable the preview feature "Enable external tool access to Power BI Desktop through secure local APIs" (File > Options > Preview features), then restart Desktop. DAX UDF / daxlib work upgrades the model compatibility level to 1702+, which is irreversible.

## PowerShell + TOM/ADOMD.NET (the connect-pbid stack)

The `connect-pbid` skill talks to Power BI Desktop's local Analysis Services instance over the Tabular Object Model (TOM) and ADOMD.NET, from PowerShell. This whole stack is Windows (native, or in a Mac's Windows VM).

PowerShell 7, if you want it alongside Windows PowerShell:

```bash
winget install Microsoft.PowerShell     # Windows
brew install powershell                 # macOS (formula; the connect-pbid path still needs the VM)
```

NuGet CLI, then the TOM and ADOMD.NET packages:

```powershell
# Windows: NuGet CLI
winget install Microsoft.NuGet

# Install both packages once (idempotent; DLLs land under lib\net45\)
$pkgDir = "$env:TEMP\tom_nuget"
nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion
nuget install Microsoft.AnalysisServices.AdomdClient.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion
```

Load the DLLs with `Add-Type -Path`. The connection is `localhost:<port>` only (no auth); the skill discovers the port from `msmdsrv.exe`. If a TOM type is missing (for example `TmdlSerializer`), the `.retail.amd64` package is too old; the newer `Microsoft.AnalysisServices` package (.NET 8+) has current types.

## .NET 8 SDK (for daxlib model operations)

The `daxlib` model operations in `connect-pbid` run a small .NET 8 console project (`daxlib-tom`), so add/update/remove/installed need the .NET 8 SDK. Read-only daxlib browsing does not.

```bash
# Windows
winget install Microsoft.DotNet.SDK.8

# macOS (cask; note that daxlib model ops still route through the Windows VM)
brew install --cask dotnet-sdk
```

Verify: `dotnet --version` (expect 8.x). Official downloads: [dotnet.microsoft.com/download/dotnet/8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0).

## daxlib (bundled)

The `daxlib` CLI is a bundled bash script in the plugin (`plugins/pbi-desktop/skills/connect-pbid/daxlib.sh`); nothing to install. It browses and installs DAX UDF packages from [daxlib.org](https://daxlib.org). Its prerequisites are `jq`, `bash` 3.2+, optionally `gh` (registry browsing, else `curl`), the .NET 8 SDK for model ops, and Power BI Desktop open.

## tmdl-validate (bundled)

The `pbip` plugin's TMDL syntax hook uses a prebuilt Rust binary that ships in `plugins/pbip/hooks/bin/` (per-OS variants for macOS arm64/x64, Linux x64, Windows x64). No install. It is unsigned, so Windows Defender or corporate AV may false-positive; whitelist it, or disable the check with `tmdl_syntax: false` in the hook `config.yaml`. It is a stopgap slated for replacement by `te validate`.

## Mac: running the Windows-only stack in a VM

Power BI Desktop, TE2, NuGet, and the TOM/ADOMD.NET PowerShell path have no macOS builds. On a Mac, the `pbi-desktop` plugin runs them inside a Windows VM through Parallels Desktop and `prlctl`. Expectations:

```
prlctl at /usr/local/bin/prlctl        install Parallels Desktop CLI tools
a licensed Windows VM                   with Power BI Desktop installed and open
shared folders enabled                  so macOS ~ maps to \\Mac\Home\ in the VM
identify the VM                         prlctl list --all  (override with DAXLIB_VM)
generous Bash timeouts                  120000-180000 ms; VM round-trips are slow
```

The skills wrap Windows commands as `prlctl exec <VM> ...` automatically once the VM is detected. Everything cloud-facing (`te`, `fab`, `az`) still runs natively on the Mac; only the local-Desktop stack needs the VM.
