#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Render (export) a published paginated report to a file via the Power BI
  export-to-file API. The "render to verify" step of the dev loop.

.DESCRIPTION
  Works on Windows PowerShell 5.1 and PowerShell 7+. The token comes from
  $env:PBI_TOKEN if set, otherwise it is minted inline via az; never written to
  disk. Pass report parameters as a JSON array via -Params. For a multi-value
  parameter, repeat the name once per value:
  -Params '[{"name":"Category","value":"A"},{"name":"Category","value":"B"}]'.

  Note: on a PPU workspace the export-to-file API allows ~1 request per 5-minute
  window (HTTP 429 otherwise); Premium/Embedded/Fabric capacity has no such cap.

  Endpoint note: export STATUS is GET .../exports/{exportId} (NOT .../status);
  the FILE is GET .../exports/{exportId}/file. The export id is opaque and is
  URL-encoded into the path.

.EXAMPLE
  ./export_rdl.ps1 -ReportId <guid> -WorkspaceId <guid>
  ./export_rdl.ps1 <reportId> <workspaceId> PDF ./out.pdf -Params '[{"name":"Category","value":"Key Account"}]'
#>
param(
  [Parameter(Mandatory)][string]$ReportId,
  [Parameter(Mandatory)][string]$WorkspaceId,
  [string]$Format = 'PDF',
  [string]$OutFile = '',
  [string]$Params = ''
)
$ErrorActionPreference = 'Stop'

$ext = switch ($Format) {
  { $_ -in 'PDF', 'ACCESSIBLEPDF' } { 'pdf' }
  'PPTX' { 'pptx' } 'XLSX' { 'xlsx' } 'DOCX' { 'docx' }
  'CSV' { 'csv' } 'XML' { 'xml' } 'MHTML' { 'mhtml' } 'IMAGE' { 'tiff' }
  default { 'bin' }
}
if (-not $OutFile) { $OutFile = "./$ReportId.$ext" }

$token = $env:PBI_TOKEN
if (-not $token) {
  $token = az account get-access-token --resource 'https://analysis.windows.net/powerbi/api' --query accessToken -o tsv
}
if (-not $token) { Write-Error 'could not obtain a Power BI access token'; exit 1 }

$base = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId/reports/$ReportId"
$auth = @{ Authorization = "Bearer $token" }

if ($Params) {
  # @(...) forces an array; ConvertFrom-Json returns a single object for a
  # one-element JSON array, which would serialize as {} instead of [{}].
  $body = @{ format = $Format; paginatedReportConfiguration = @{ parameterValues = @($Params | ConvertFrom-Json) } } | ConvertTo-Json -Depth 6
}
else {
  $body = @{ format = $Format } | ConvertTo-Json
}

Write-Host "Exporting report $ReportId to $Format ..."
$exp = Invoke-RestMethod -Uri "$base/ExportTo" -Method Post -Headers $auth -ContentType 'application/json' -Body $body
$eid = [uri]::EscapeDataString($exp.id)

$status = $null
for ($i = 0; $i -lt 80; $i++) {
  $st = Invoke-RestMethod -Uri "$base/exports/$eid" -Headers $auth
  $status = $st.status
  Write-Host "  status: $status ($($st.percentComplete)%)"
  if ($status -eq 'Succeeded') { break }
  if ($status -eq 'Failed') { Write-Error "export failed: $($st.error | ConvertTo-Json)"; exit 1 }
  Start-Sleep -Seconds 3
}
if ($status -ne 'Succeeded') { Write-Error 'export did not finish in time'; exit 1 }

Invoke-WebRequest -Uri "$base/exports/$eid/file" -Headers $auth -OutFile $OutFile | Out-Null
Write-Host "Saved $OutFile ($((Get-Item $OutFile).Length) bytes)"
