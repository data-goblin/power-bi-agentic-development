<#
.SYNOPSIS
    Enable long path support on Windows for git clone and file operations.

.DESCRIPTION
    The Power BI agentic development marketplace ships TMDL files whose
    repository-relative paths exceed Windows' legacy MAX_PATH (260
    characters). Without long path support, `git clone` aborts with
    `Filename too long` and any plugin install that wraps a clone fails.

    This script toggles two settings:
      1. HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1
         The OS-level switch. Requires admin. A reboot is recommended.
      2. git config --system core.longpaths true
         The git-level switch. Required even after step 1, because git
         on Windows still defaults to the legacy MAX_PATH unless told
         otherwise. Requires admin (system-level git config).

    Reference: https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation

.NOTES
    Run from an elevated PowerShell prompt. The script self-checks and
    aborts cleanly if not running as administrator.

.EXAMPLE
    .\enable-windows-longpaths.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $current = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($current)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Error "This script must run as administrator. Right-click PowerShell and choose 'Run as administrator', then re-run."
    exit 1
}

# 1. Windows long path support
$regPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem'
$regName = 'LongPathsEnabled'

$current = (Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue).$regName

if ($current -eq 1) {
    Write-Host "[1/2] Windows long paths already enabled (LongPathsEnabled=1)." -ForegroundColor Green
} else {
    Set-ItemProperty -Path $regPath -Name $regName -Value 1 -Type DWord
    Write-Host "[1/2] Set HKLM:\...\FileSystem\LongPathsEnabled = 1." -ForegroundColor Green
    Write-Host "      A reboot is recommended for this to take full effect."
}

# 2. Git long path support
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning "[2/2] git is not on PATH. Install git (https://git-scm.com/) and re-run, or set 'core.longpaths' manually."
    exit 0
}

$currentGit = (git config --system --get core.longpaths) 2>$null

if ($currentGit -eq 'true') {
    Write-Host "[2/2] git core.longpaths already true." -ForegroundColor Green
} else {
    git config --system core.longpaths true
    Write-Host "[2/2] Set git core.longpaths = true (system-level)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Long path support is enabled." -ForegroundColor Cyan
Write-Host "If you toggled the registry key just now, reboot before retrying 'copilot plugin install' or 'git clone'."
