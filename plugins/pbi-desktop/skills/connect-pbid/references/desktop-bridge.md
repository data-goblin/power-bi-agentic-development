# Desktop Bridge: driving the report canvas over the raw named pipe

Power BI Desktop exposes a second local API beside the Analysis Services engine: a
per-process JSON-RPC server on a Windows named pipe that controls the report canvas
(reload + snapshot). **When the `pbir` CLI is installed, use `pbir desktop list/refresh/screenshot`
instead of anything below; never drive the pipe from PowerShell when `pbir` is available.**
This raw-pipe path exists for machines without `pbir`: PowerShell straight to the pipe,
the same way this skill rawdogs TOM/ADOMD. (The `powerbi-desktop` npm CLI wraps
these same methods; the `pbir-format` and `pbir-cli` skills cover that wrapper path.)

Use it together with the model API: change the model with TOM, then reload and
snapshot the report to confirm the visuals reflect the change.

## The endpoint

- Pipe: `\\.\pipe\pbi-desktop-bridge-<PID>`, one per Desktop process. Discover it by
  enumerating the pipe directory for the prefix; `<PID>` is the PBIDesktop.exe id:

```powershell
[System.IO.Directory]::GetFiles("\\.\pipe\") |
  Where-Object { $_ -match 'pbi-desktop-bridge-(\d+)$' }
```

  The pipe exists only when the bridge **preview setting is enabled**: in Power BI
  Desktop, File > Options and settings > Options > Preview features, turn on the
  developer-mode / report-bridge preview feature and restart Desktop. If no pipe is
  found, that setting is off or Desktop is closed.
- Protocol: JSON-RPC 2.0 with LSP-style `Content-Length` framing (vscode-jsonrpc over
  the pipe stream). No initialize handshake; connect and call.

## Methods (params and returns, as the bridge defines them)

```yaml
bridge.manifest:            {}                                -> capability manifest (call first to confirm availability)
application.state.get/v1:   {}                                -> { currentFilePath, hasUnsavedChanges }
file.reload/v1:             { reloadModelDefinition: false }  -> { success }      # reloads on-disk PBIR into the live canvas
report.snapshot.capture/v1: { pageId, scale }                -> { payload, encoding, pageId, pageDisplayName, mimeType }
```

- `pageId` is the PBIR section id (e.g. `ReportSection1a2b3c`), not the display name.
- `scale` is 1 to 3 (2 is a good default for readable review).
- `report.snapshot.capture/v1` returns the PNG as a base64 string in `payload`
  (`encoding` is `base64`, `mimeType` is `image/png`).
- `file.reload/v1` with `reloadModelDefinition: false` reloads the report definition
  only; this is the canvas refresh after a PBIR edit.

## Raw PowerShell client

```powershell
# 1. connect to the bridge pipe for the target Desktop process
$procId = (Get-Process PBIDesktop -ErrorAction Stop | Select-Object -First 1).Id
$pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "pbi-desktop-bridge-$procId",
          [System.IO.Pipes.PipeDirection]::InOut)
$pipe.Connect(5000)

# 2. JSON-RPC over the pipe with LSP Content-Length framing
function Read-Frame($pipe) {
    $win = ""; $one = New-Object byte[] 1; $hdr = New-Object Text.StringBuilder
    while ($true) {
        if ($pipe.Read($one, 0, 1) -le 0) { throw "pipe closed" }
        $c = [char]$one[0]; [void]$hdr.Append($c)
        $win = ($win + $c); if ($win.Length -gt 4) { $win = $win.Substring(1) }
        if ($win -eq "`r`n`r`n") { break }
    }
    $len = [int]([regex]::Match($hdr.ToString(), 'Content-Length:\s*(\d+)').Groups[1].Value)
    $buf = New-Object byte[] $len; $off = 0
    while ($off -lt $len) { $n = $pipe.Read($buf, $off, $len - $off); if ($n -le 0) { throw "eof" }; $off += $n }
    [Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
}
function Invoke-Bridge($pipe, [int]$id, [string]$method, $params) {
    $json   = @{ jsonrpc = "2.0"; id = $id; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 10
    $body   = [Text.Encoding]::UTF8.GetBytes($json)
    $header = [Text.Encoding]::ASCII.GetBytes("Content-Length: $($body.Length)`r`n`r`n")
    $pipe.Write($header, 0, $header.Length); $pipe.Write($body, 0, $body.Length); $pipe.Flush()
    Read-Frame $pipe
}

# 3. calls
Invoke-Bridge $pipe 1 "bridge.manifest" @{} | Out-Null
$state = Invoke-Bridge $pipe 2 "application.state.get/v1" @{}              # confirm $state.currentFilePath matches your PBIP
Invoke-Bridge $pipe 3 "file.reload/v1" @{ reloadModelDefinition = $false } # refresh the canvas after a PBIR edit
$shot  = Invoke-Bridge $pipe 4 "report.snapshot.capture/v1" @{ pageId = "ReportSection1a2b3c"; scale = 2 }
[IO.File]::WriteAllBytes("page.png", [Convert]::FromBase64String($shot.payload))
$pipe.Dispose()
```

The reader reads header bytes one at a time up to `\r\n\r\n`, then exactly
`Content-Length` body bytes; do not wrap the pipe in a buffering `StreamReader`, it
will swallow the next frame's bytes.

## Model-and-report loop, rawdogged

```powershell
# model edit via TOM (this skill's main body), applied live
$model.Tables["Sales"].Measures["Revenue"].FormatString = "\$#,0"
$model.SaveChanges()
# then confirm the report reflects it, no reopen
Invoke-Bridge $pipe 5 "file.reload/v1" @{ reloadModelDefinition = $false }
$shot = Invoke-Bridge $pipe 6 "report.snapshot.capture/v1" @{ pageId = "ReportSection1a2b3c"; scale = 2 }
[IO.File]::WriteAllBytes("sales.png", [Convert]::FromBase64String($shot.payload))
```

On-disk PBIR (report) edits are picked up by `file.reload/v1`. On-disk TMDL (model)
edits are not; prefer live TOM `SaveChanges()` for model changes.

## Locating the open PBIP from the bridge

You do not need the file path in advance. Enumerate the pipe directory to auto-discover
the running Desktop PID, connect, and call `application.state.get/v1`; its
`currentFilePath` is the open `.pbip`/`.pbix` on disk. From it you have the project
folder and its `.Report` (PBIR) and `.SemanticModel` siblings, ready to drive with
`pbir` / the `pbir-format` skill. This is more reliable than the recent-file-history
method (section 10), which reads history rather than the live instance.

```powershell
$procId = [System.IO.Directory]::GetFiles("\\.\pipe\") |
          ForEach-Object { if ($_ -match 'pbi-desktop-bridge-(\d+)$') { $matches[1] } } |
          Select-Object -First 1
# connect to pbi-desktop-bridge-$procId (above), then:
$state     = Invoke-Bridge $pipe 1 "application.state.get/v1" @{}
$pbip      = $state.currentFilePath                              # e.g. C:\Reports\Sales\Sales.pbip
$reportDir = Join-Path (Split-Path $pbip) ((Split-Path $pbip -LeafBase) + ".Report")
```

## Higher-level wrapper: the pbir CLI

If the raw pipe client misbehaves (framing, encoding, or a build that changed a param
shape), use the `pbir desktop` commands (reports plugin `pbir-cli` skill); they speak the
same methods over the same pipe (the same preview setting must be enabled):

```bash
pbir desktop list                                  # list instances; pick the PID (`status` is an alias)
pbir desktop reload --pid <pid>                    # wraps file.reload/v1
pbir desktop screenshot "<report>/<page>.Page" --pid <pid> -o page.png   # wraps report.snapshot.capture/v1
```

Same endpoint, higher level. The `pbir-cli` skill documents this path in full.

## Notes

- macOS: run inside the Parallels VM, the same path this skill uses for PowerShell;
  see [parallels-macos.md](./parallels-macos.md).
- To CHANGE visuals, pages, or formatting, route to the `pbir-cli` skill; the bridge
  only reloads and snapshots, it never edits the report.
- This is the named-pipe API distinct from the Analysis Services XMLA port this skill
  connects to for the model; the two are independent.
