---
title: Reaching Desktop in a Parallels VM from macOS
summary: prlctl routing, shared-folder script execution, escaping and timeouts for running PowerShell against Desktop in a VM.
kind: gotcha
status: current
sources:
  - url: https://docs.parallels.com/landing/parallels-desktop-developers-guide/command-line-interface-utility/manage-virtual-machines-from-cli/general-virtual-machine-management/execute-a-command-in-a-virtual-machine
tools: {}
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 180
skills: [pbi-desktop/connect-pbid]
---

# Desktop in a Parallels VM

Desktop and its Analysis Services instance run inside the VM, so every PowerShell call goes through `prlctl exec`. `prlctl exec <vm> <command>` needs Parallels Tools installed in the guest ([Parallels docs](https://docs.parallels.com/landing/parallels-desktop-developers-guide/command-line-interface-utility/manage-virtual-machines-from-cli/general-virtual-machine-management/execute-a-command-in-a-virtual-machine)); `scripts/connect-from-mac.sh <vm> <script.ps1> [args]` wraps the steps.

```bash
prlctl list --all                                   # VM names
prlctl exec <VM> cmd.exe /c "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"\\\\Mac\\Home\\Desktop\\script.ps1\""
```

- Write the `.ps1` on the Mac under a shared folder (`~/Desktop` is `\\Mac\Home\Desktop`) and run it with `-File`. Three escaping layers (`prlctl`, `cmd.exe`, `powershell.exe`) break inline commands and paths with spaces; if you must inline, pass `-EncodedCommand` with the script as UTF-16LE base64
- The `.retail.amd64` package puts DLLs under `net45`, so a `net472` filter finds nothing
- The Desktop Bridge and the hooks in this plugin run inside the VM, not on the Mac
