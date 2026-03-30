# Export Model (TMSL / TMDL)

Export the current in-memory model from Power BI Desktop to BIM (TMSL JSON) or TMDL on disk — useful for snapshotting the live state, passing to `te` (Tabular Editor CLI) or `fab` (Fabric CLI) for deployment.

All examples assume `$server`, `$db`, and `$port` are already set up (see SKILL.md sections 2–3).

## Via Tabular Editor CLI (recommended)

The cleanest and most reliable path — TE2/TE3 CLI connects directly to the local AS port:

```bash
# Find port first (PowerShell)
$cmd = (Get-WmiObject Win32_Process -Filter "Name='msmdsrv.exe'").CommandLine
$portFile = [regex]::Match($cmd, '-s "([^"]+)"').Groups[1].Value + "\msmdsrv.port.txt"
$port = [System.Text.Encoding]::Unicode.GetString([System.IO.File]::ReadAllBytes($portFile)).Trim()
$dbName = $server.Databases[0].Name

# Export as BIM (TMSL JSON)
TabularEditor.exe "localhost:$port" "$dbName" -B "C:\export\model.bim"

# Export as TMDL folder
TabularEditor.exe "localhost:$port" "$dbName" -T "C:\export\definition"
```

See the `te2-cli` skill for full Tabular Editor CLI reference.

## Via fab CLI (if model is published to Fabric)

If the model is already deployed to a Fabric workspace, export from there instead:

```bash
fab export "WorkspaceName.Workspace/ModelName.SemanticModel" -o ./export -f
```

See the `fabric-cli` skill for full `fab` reference.

## Via TOM — TMDL Serializer (requires newer TOM DLL)

```powershell
$tmdlFolder = "C:\Users\$env:USERNAME\Desktop\export-tmdl"
[Microsoft.AnalysisServices.Tabular.TmdlSerializer]::SerializeModelToFolder($db.Model, $tmdlFolder)
Write-Output "Exported to $tmdlFolder"
```

> If `TmdlSerializer` is not found, your NuGet package is too old. Update `Microsoft.AnalysisServices.retail.amd64` and retry, or use Tabular Editor CLI above.

## Via TOM — BIM (TMSL JSON)

TOM doesn't have a built-in BIM serializer. The closest approach is scripting via XMLA:

```powershell
# Use ScriptCreateOrReplace to generate TMSL, then save to file
# Simpler: just call Tabular Editor CLI against the port (see above)
# If you must use PowerShell only:
$json = [Newtonsoft.Json.JsonConvert]::SerializeObject(
    $db.Model,
    [Newtonsoft.Json.Formatting]::Indented
)
Set-Content -Path "C:\export\model.bim" -Value $json
```

> This produces a partial JSON dump, not a fully valid BIM. Use TE CLI for reliable BIM output.
