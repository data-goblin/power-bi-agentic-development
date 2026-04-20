# Check referential integrity for all relationships in the connected model.
# Reports orphaned foreign keys, M:M orphans, and "Assume RI" risks.
# Usage: powershell -ExecutionPolicy Bypass -File check-referential-integrity.ps1 -Port <port>

param(
    [Parameter(Mandatory=$true)][int]$Port
)

#region Imports
$basePath = "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.retail.amd64\lib\net45"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"
Add-Type -Path "$env:TEMP\tom_nuget\Microsoft.AnalysisServices.AdomdClient.retail.amd64\lib\net45\Microsoft.AnalysisServices.AdomdClient.dll"
#endregion


#region Connect
$server = New-Object Microsoft.AnalysisServices.Tabular.Server
$server.Connect("Data Source=localhost:$Port")
$model = $server.Databases[0].Model

$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
$conn.ConnectionString = "Data Source=localhost:$Port"
$conn.Open()
#endregion


#region Helper: run EXCEPT query and return orphaned values
function Get-Orphans {
    param($TableA, $ColA, $TableB, $ColB)

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "EVALUATE EXCEPT(VALUES('${TableA}'[${ColA}]), VALUES('${TableB}'[${ColB}]))"

    $orphans = @()
    try {
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) {
            $val = $reader.GetValue(0)
            if ($val -ne $null) { $orphans += "$val" }
        }
        $reader.Close()
    } catch {
        # Query failed; likely incompatible types or missing table
        return @()
    }
    return $orphans
}


function Format-Sample {
    param($Items, $Max)
    if ($Items.Count -eq 0) { return "" }
    $sample = ($Items | Select-Object -First $Max) -join ", "
    $suffix = ""
    if ($Items.Count -gt $Max) { $suffix = " ... (+$($Items.Count - $Max) more)" }
    return "${sample}${suffix}"
}
#endregion


#region Check each relationship
$violations = @()

foreach ($rel in $model.Relationships) {
    $sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel

    $fromTable = $sr.FromTable.Name
    $fromCol   = $sr.FromColumn.Name
    $toTable   = $sr.ToTable.Name
    $toCol     = $sr.ToColumn.Name
    $fromCard  = "$($sr.FromCardinality)"
    $toCard    = "$($sr.ToCardinality)"
    $isActive  = $sr.IsActive

    # Check cross-filter direction and "Assume RI" (only on DirectQuery; local models don't have this)
    # TOM exposes RelyOnReferentialIntegrity for DQ relationships
    $assumeRI = $false
    try { $assumeRI = $sr.RelyOnReferentialIntegrity } catch {}

    $relLabel  = "'${fromTable}'[${fromCol}] (${fromCard}) -> '${toTable}'[${toCol}] (${toCard})"
    if (-not $isActive) { $relLabel += " [INACTIVE]" }

    # Determine relationship type
    $isManyToOne = ($fromCard -eq "Many" -and $toCard -eq "One")
    $isOneToMany = ($fromCard -eq "One" -and $toCard -eq "Many")
    $isManyToMany = ($fromCard -eq "Many" -and $toCard -eq "Many")
    $isOneToOne = ($fromCard -eq "One" -and $toCard -eq "One")

    # Check from-side orphans
    $orphansFrom = Get-Orphans -TableA $fromTable -ColA $fromCol -TableB $toTable -ColB $toCol

    # Check to-side orphans
    $orphansTo = Get-Orphans -TableA $toTable -ColA $toCol -TableB $fromTable -ColB $fromCol

    if ($orphansFrom.Count -eq 0 -and $orphansTo.Count -eq 0) { continue }

    $entry = @{
        rel = $relLabel
        fromOrphans = $orphansFrom
        toOrphans = $orphansTo
        isManyToOne = $isManyToOne
        isOneToMany = $isOneToMany
        isManyToMany = $isManyToMany
        isOneToOne = $isOneToOne
        assumeRI = $assumeRI
    }
    $violations += $entry
}
#endregion


#region Output
if ($violations.Count -eq 0) {
    Write-Output "RI_OK: All relationships pass referential integrity checks."
} else {
    foreach ($v in $violations) {
        Write-Output "RI_VIOLATION: $($v.rel)"

        # Many-to-One: many-side values with no match on one-side (blank virtual row in visuals)
        if ($v.isManyToOne -and $v.fromOrphans.Count -gt 0) {
            $sample = Format-Sample -Items $v.fromOrphans -Max 10
            Write-Output "  UNMATCHED_MANY_SIDE ($($v.fromOrphans.Count)): $sample"
        }

        # One-to-Many (reversed): one-side values with no match
        if ($v.isOneToMany -and $v.toOrphans.Count -gt 0) {
            $sample = Format-Sample -Items $v.toOrphans -Max 10
            Write-Output "  UNMATCHED_MANY_SIDE ($($v.toOrphans.Count)): $sample"
        }

        # Many-to-Many: orphans on EITHER side are silently excluded (INNER JOIN semantics)
        if ($v.isManyToMany) {
            if ($v.fromOrphans.Count -gt 0) {
                $sample = Format-Sample -Items $v.fromOrphans -Max 10
                Write-Output "  SILENT_EXCLUSION from-side ($($v.fromOrphans.Count)): $sample"
            }
            if ($v.toOrphans.Count -gt 0) {
                $sample = Format-Sample -Items $v.toOrphans -Max 10
                Write-Output "  SILENT_EXCLUSION to-side ($($v.toOrphans.Count)): $sample"
            }
        }

        # One-to-One: unmatched on either side produce blank virtual rows
        if ($v.isOneToOne) {
            if ($v.fromOrphans.Count -gt 0) {
                $sample = Format-Sample -Items $v.fromOrphans -Max 10
                Write-Output "  UNMATCHED_MANY_SIDE from-side ($($v.fromOrphans.Count)): $sample"
            }
            if ($v.toOrphans.Count -gt 0) {
                $sample = Format-Sample -Items $v.toOrphans -Max 10
                Write-Output "  UNMATCHED_MANY_SIDE to-side ($($v.toOrphans.Count)): $sample"
            }
        }

        # Many-to-One / One-to-Many: unmatched one-side values (not a violation; unused dimension members)
        if ($v.isManyToOne -and $v.toOrphans.Count -gt 0) {
            $sample = Format-Sample -Items $v.toOrphans -Max 10
            Write-Output "  UNMATCHED_ONE_SIDE ($($v.toOrphans.Count)): $sample"
        }
        if ($v.isOneToMany -and $v.fromOrphans.Count -gt 0) {
            $sample = Format-Sample -Items $v.fromOrphans -Max 10
            Write-Output "  UNMATCHED_ONE_SIDE ($($v.fromOrphans.Count)): $sample"
        }

        # Flag if Assume RI is enabled on a relationship with violations
        if ($v.assumeRI) {
            Write-Output "  ASSUME_RI_RISK: 'Assume Referential Integrity' is enabled; unmatched rows will be silently dropped from query results."
        }
    }
}
#endregion


#region Disconnect
$conn.Close()
$server.Disconnect()
#endregion
