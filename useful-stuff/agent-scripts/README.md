# Agent scripts

Helper scripts that smooth out installing and running Claude Code, GitHub Copilot CLI, and similar agentic tooling.

| Script | Description |
|--------|-------------|
| [`enable-windows-longpaths.ps1`](enable-windows-longpaths.ps1) | Example: enable Windows + git long path support so `copilot plugin install`, `git clone`, and other long-path operations don't blow up on `Filename too long`. Often needed on Windows before installing the Copilot CLI or this marketplace's plugins |

## enable-windows-longpaths.ps1

Windows enforces a legacy 260-character path limit (`MAX_PATH`). The Power BI agentic development marketplace ships TMDL files with deep paths that exceed it, so `copilot plugin install` and `git clone` fail with `Filename too long` on a default Windows install.

The script toggles two settings:

1. `HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1` (OS-level; reboot recommended)
2. `git config --system core.longpaths true` (git-level; needed even after the OS flag)

Run from an elevated PowerShell prompt:

```powershell
.\enable-windows-longpaths.ps1
```

The script self-checks for admin rights and aborts cleanly if not elevated. Reboot before retrying the install.
