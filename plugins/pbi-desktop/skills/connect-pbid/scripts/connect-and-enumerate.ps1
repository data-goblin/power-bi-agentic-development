# connect-and-enumerate.ps1
# Connects to Power BI Desktop's local Analysis Services instance and enumerates the full model.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File connect-and-enumerate.ps1 [-Port <port>]
#
# If -Port is omitted, discovers all msmdsrv.exe ports automatically and connects to each.

param(
    [int]$Port = 0
)


#region Setup

$pkgDir = "$env:TEMP\tom_nuget"
$basePath = "$pkgDir\Microsoft.AnalysisServices.retail.amd64\lib\net45"

# Install TOM if missing
if (-not (Test-Path "$basePath\Microsoft.AnalysisServices.Tabular.dll")) {
    Write-Output "Installing TOM NuGet package..."
    nuget install Microsoft.AnalysisServices.retail.amd64 -OutputDirectory $pkgDir -ExcludeVersion | Out-Null
}

# Load assemblies
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Core.dll"
Add-Type -Path "$basePath\Microsoft.AnalysisServices.Tabular.dll"

#endregion


#region Port Discovery

if ($Port -gt 0) {
    $ports = @($Port)
} else {
    $pids = (Get-Process msmdsrv -ErrorAction SilentlyContinue).Id
    if (-not $pids) {
        Write-Error "No msmdsrv.exe processes found. Is Power BI Desktop open?"
        exit 1
    }

    $ports = @()
    $netstat = netstat -ano | Select-String "LISTENING"
    foreach ($line in $netstat) {
        $parts = ($line -split "\s+") | Where-Object { $_ -ne "" }
        # $pid is a read-only automatic variable in PowerShell; use another name
        $ownerPid = $parts[-1]
        if ($pids -contains [int]$ownerPid) {
            $portNum = ($parts[1] -split ":")[-1]
            if ($ports -notcontains $portNum) {
                $ports += $portNum
            }
        }
    }

    if ($ports.Count -eq 0) {
        Write-Error "Found msmdsrv.exe but could not determine listening ports."
        exit 1
    }
}

#endregion


#region Enumerate

foreach ($p in $ports) {
    Write-Output ""
    Write-Output ("=" * 80)
    Write-Output "CONNECTING TO localhost:$p"
    Write-Output ("=" * 80)

    try {
        $server = New-Object Microsoft.AnalysisServices.Tabular.Server
        $server.Connect("Data Source=localhost:$p")
        Write-Output "Server: $($server.Name) | Version: $($server.Version)"
        Write-Output "Databases: $($server.Databases.Count)"

        foreach ($db in $server.Databases) {
            Write-Output ""
            Write-Output ("-" * 60)
            Write-Output "DATABASE: $($db.Name)"
            Write-Output "Compatibility: $($db.CompatibilityLevel)"
            Write-Output ("-" * 60)

            $model = $db.Model
            if (-not $model) {
                Write-Output "  (no model loaded)"
                continue
            }

            # Tables, columns, measures
            Write-Output ""
            Write-Output "=== TABLES ($($model.Tables.Count)) ==="
            foreach ($table in $model.Tables) {
                $isCalcGroup = $table.CalculationGroup -ne $null
                $tag = if ($isCalcGroup) { " [Calc Group]" } else { "" }
                Write-Output ""
                Write-Output "  TABLE: [$($table.Name)]$tag"

                Write-Output "    Columns ($($table.Columns.Count)):"
                foreach ($col in $table.Columns) {
                    $hidden = if ($col.IsHidden) { " [Hidden]" } else { "" }
                    $colType = if ($col -is [Microsoft.AnalysisServices.Tabular.CalculatedColumn]) { " (Calc)" } else { "" }
                    Write-Output "      [$($col.Name)] $($col.DataType)$colType$hidden"
                }

                if ($table.Measures.Count -gt 0) {
                    Write-Output "    Measures ($($table.Measures.Count)):"
                    foreach ($m in $table.Measures) {
                        Write-Output "      [$($m.Name)]"
                        $lines = $m.Expression -split "`r?`n"
                        foreach ($line in $lines) {
                            Write-Output "        $line"
                        }
                    }
                }

                if ($table.Hierarchies.Count -gt 0) {
                    Write-Output "    Hierarchies ($($table.Hierarchies.Count)):"
                    foreach ($h in $table.Hierarchies) {
                        $levels = ($h.Levels | Sort-Object Ordinal | ForEach-Object { $_.Name }) -join " > "
                        Write-Output "      [$($h.Name)]: $levels"
                    }
                }

                if ($isCalcGroup) {
                    Write-Output "    Calculation Items ($($table.CalculationGroup.CalculationItems.Count)):"
                    foreach ($ci in $table.CalculationGroup.CalculationItems) {
                        Write-Output "      [$($ci.Name)] = $($ci.Expression)"
                    }
                }
            }

            # Relationships
            Write-Output ""
            Write-Output "=== RELATIONSHIPS ($($model.Relationships.Count)) ==="
            foreach ($rel in $model.Relationships) {
                $sr = [Microsoft.AnalysisServices.Tabular.SingleColumnRelationship]$rel
                if ($sr) {
                    $active = if ($sr.IsActive) { "Active" } else { "Inactive" }
                    Write-Output "  [$($sr.FromTable.Name)].[$($sr.FromColumn.Name)] --> [$($sr.ToTable.Name)].[$($sr.ToColumn.Name)]  ($($sr.FromCardinality) -> $($sr.ToCardinality)) [$active] CrossFilter=$($sr.CrossFilteringBehavior)"
                }
            }

            # Roles
            if ($model.Roles.Count -gt 0) {
                Write-Output ""
                Write-Output "=== ROLES ($($model.Roles.Count)) ==="
                foreach ($role in $model.Roles) {
                    Write-Output "  [$($role.Name)] Permission=$($role.ModelPermission)"
                    foreach ($tp in $role.TablePermissions) {
                        Write-Output "    Table: [$($tp.Table.Name)] Filter: $($tp.FilterExpression)"
                    }
                }
            }

            # Perspectives
            if ($model.Perspectives.Count -gt 0) {
                Write-Output ""
                Write-Output "=== PERSPECTIVES ($($model.Perspectives.Count)) ==="
                foreach ($p in $model.Perspectives) {
                    Write-Output "  [$($p.Name)]"
                }
            }

            # Expressions (shared M queries)
            if ($model.Expressions.Count -gt 0) {
                Write-Output ""
                Write-Output "=== EXPRESSIONS ($($model.Expressions.Count)) ==="
                foreach ($e in $model.Expressions) {
                    Write-Output "  [$($e.Name)] Kind=$($e.Kind)"
                }
            }
        }

        $server.Disconnect()
    }
    catch {
        Write-Output "ERROR on port ${p}: $($_.Exception.Message)"
    }
}

#endregion
