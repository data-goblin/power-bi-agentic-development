#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Publish a paginated report (.rdl) to a Power BI / Fabric workspace.

.DESCRIPTION
  Uploads via the Power BI Imports API (multipart form post). The workspace must
  be backed by Premium / Embedded / Fabric capacity for the report to run.
  Overwrite and Abort are asymmetric: Overwrite requires the report to already
  exist (a first-time Overwrite returns 404), Abort creates a new one. When the
  conflict mode is omitted this auto-detects which to use.

  Works on Windows PowerShell 5.1 and PowerShell 7+ (uses .NET HttpClient for the
  multipart upload). The token comes from $env:PBI_TOKEN if set, otherwise it is
  minted inline via az; it is never written to disk.

.EXAMPLE
  ./publish_rdl.ps1 -RdlPath ./Report.rdl -WorkspaceId <guid>
  ./publish_rdl.ps1 ./Report.rdl <guid> Overwrite
#>
param(
  [Parameter(Mandatory)][string]$RdlPath,
  [Parameter(Mandatory)][string]$WorkspaceId,
  [ValidateSet('', 'Abort', 'Overwrite')][string]$NameConflict = '',
  [string]$DisplayName = ''
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $RdlPath)) { Write-Error "file not found: $RdlPath"; exit 2 }
if (-not $DisplayName) { $DisplayName = Split-Path $RdlPath -Leaf }
if ($DisplayName -notlike '*.rdl') { $DisplayName += '.rdl' }

$token = $env:PBI_TOKEN
if (-not $token) {
  $token = az account get-access-token --resource 'https://analysis.windows.net/powerbi/api' --query accessToken -o tsv
}
if (-not $token) { Write-Error 'could not obtain a Power BI access token'; exit 1 }

$base = "https://api.powerbi.com/v1.0/myorg/groups/$WorkspaceId"
$auth = @{ Authorization = "Bearer $token" }

if (-not $NameConflict) {
  $baseName = $DisplayName -replace '\.rdl$', ''
  $reports = (Invoke-RestMethod -Uri "$base/reports" -Headers $auth).value
  $exists = $reports | Where-Object { $_.name -eq $baseName -and $_.reportType -eq 'PaginatedReport' }
  $NameConflict = if ($exists) { 'Overwrite' } else { 'Abort' }
}

Write-Host "Uploading $(Split-Path $RdlPath -Leaf) as '$DisplayName' (nameConflict=$NameConflict) ..."

# On Windows PowerShell 5.1 the assembly must be loaded; on PowerShell 7+ it is
# already present and Add-Type can throw, so ignore failure.
try { Add-Type -AssemblyName System.Net.Http -ErrorAction Stop } catch { }
$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization =
  [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
$form = [System.Net.Http.MultipartFormDataContent]::new()
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $RdlPath))
$form.Add([System.Net.Http.ByteArrayContent]::new($bytes), 'file', (Split-Path $RdlPath -Leaf))
$url = "$base/imports?datasetDisplayName=$([uri]::EscapeDataString($DisplayName))&nameConflict=$NameConflict"
$resp = $client.PostAsync($url, $form).Result
$respBody = $resp.Content.ReadAsStringAsync().Result
if (-not $resp.IsSuccessStatusCode) {
  Write-Error "import returned HTTP $([int]$resp.StatusCode): $respBody"; exit 1
}
$importId = ($respBody | ConvertFrom-Json).id
Write-Host "Import id: $importId"

for ($i = 0; $i -lt 60; $i++) {
  $st = Invoke-RestMethod -Uri "$base/imports/$importId" -Headers $auth
  Write-Host "  importState: $($st.importState)"
  if ($st.importState -eq 'Succeeded') {
    $st.reports | ForEach-Object { Write-Host "report: $($_.name)  id: $($_.id)  webUrl: $($_.webUrl)" }
    exit 0
  }
  if ($st.importState -eq 'Failed') { Write-Error "import failed: $($st.error | ConvertTo-Json)"; exit 1 }
  Start-Sleep -Seconds 3
}
Write-Error 'import did not complete within the polling window'; exit 1
