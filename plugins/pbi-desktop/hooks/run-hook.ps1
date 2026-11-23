# run-hook.ps1: Windows entry point for this plugin's bash hook scripts.
#
# Copilot CLI runs plugin hooks through PowerShell on Windows and treats any
# non-zero exit from a PreToolUse hook as a denial (fail-closed); Claude Code
# runs hooks through bash and blocks only on exit 2. This shim bridges the two:
# it locates Git Bash, forwards the hook JSON on stdin to the named script, and
# exits 2 only when the script itself blocks. Every other outcome (no bash, no
# script, launch failure) exits 0, so a missing tool can never deny an
# unrelated tool call in an unrelated project.
#
# Usage: run-hook.ps1 <script.sh> [args...]
param(
    [string]$Script,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
)

# Native stderr must reach the host unchanged (it carries the blocking
# message on exit 2), so do not escalate errors here; try/catch covers the rest.
$ErrorActionPreference = 'Continue'

try {
    if (-not $Script) { exit 0 }

    # Prefer Git Bash. WSL's System32\bash.exe cannot open C:\ paths.
    $candidates = @()
    foreach ($c in @(Get-Command bash.exe -All -ErrorAction SilentlyContinue)) {
        if ($c.Source -and $c.Source -notlike '*\System32\*') { $candidates += $c.Source }
    }
    foreach ($p in @("$env:ProgramFiles\Git\bin\bash.exe",
                     "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
                     "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe")) {
        if ($p -and (Test-Path -LiteralPath $p)) { $candidates += $p }
    }
    $bash = $candidates | Select-Object -First 1
    if (-not $bash) { [Console]::Error.WriteLine('pbi-desktop hooks are OFF: Git Bash was not found. Install Git for Windows to enable them.'); exit 0 }

    $target = Join-Path $PSScriptRoot $Script
    if (-not (Test-Path -LiteralPath $target)) { [Console]::Error.WriteLine("pbi-desktop hooks are OFF: $target does not exist."); exit 0 }
    $posix = $target -replace '\\', '/'

    # Windows PowerShell pipes to native commands in the console code page by
    # default; hook JSON can carry non-ASCII paths and DAX, so pipe as UTF-8.
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
    $payload = [Console]::In.ReadToEnd()
    if ($ScriptArgs) {
        $payload | & $bash $posix @ScriptArgs
    } else {
        $payload | & $bash $posix
    }
    if ($LASTEXITCODE -eq 2) { exit 2 }
    exit 0
} catch {
    exit 0
}
