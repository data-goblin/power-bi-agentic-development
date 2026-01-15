---
name: tabular-editor-cli
description: This skill should be used when the user asks to "run TabularEditor.exe", "deploy a model via CLI", "use Tabular Editor command line", "set up CI/CD for Power BI", "automate model deployment", "run BPA from command line", "save model as TMDL", "compare model schemas", or mentions TabularEditor.exe flags like -D, -S, -A, -B, -T, -O, -C. Provides CLI syntax reference for Tabular Editor 2/3 deployment, scripting, BPA analysis, and CI/CD integration. Distinct from c-sharp-scripting skill which covers writing script content rather than CLI execution.
---

# Tabular Editor CLI

Command-line interface for Tabular Editor 2 (TE2) and Tabular Editor 3 (TE3).


## Installation

### Tabular Editor 2 (Free)
- Download: https://github.com/TabularEditor/TabularEditor/releases
- Extract to preferred location or use Chocolatey: `choco install tabulareditor2`

### Tabular Editor 3 (Licensed)
- Download: https://tabulareditor.com/downloads
- Or use MSI installer for enterprise deployment


## Executables

| Version | Executable | Notes |
|---------|------------|-------|
| TE2 | `TabularEditor.exe` or `start.cmd` | Free, Windows-only |
| TE3 | `TabularEditor.exe` (TE3 folder) | Licensed, Windows/Mac/Linux |


## Connection Sources

### Local Files
```bash
# model.bim (JSON format)
TabularEditor.exe Model.bim

# TMDL folder
TabularEditor.exe definition/

# PBIP project
TabularEditor.exe MyReport.pbip
```

### Remote XMLA Endpoints
```bash
# Analysis Services
TabularEditor.exe "localhost\tabular" "AdventureWorks"

# Power BI Premium/Fabric
TabularEditor.exe "powerbi://api.powerbi.com/v1.0/myorg/WorkspaceName" "ModelName"
```

### Power BI Desktop
```bash
# Auto-detect running instance
TabularEditor.exe localhost:PORT DatabaseName
```
Note: Find the port in PBIDesktop diagnostic files or use tools like DAX Studio.


## Command-Line Reference

### Basic Syntax
```bash
TabularEditor.exe <source> [options]
```

### Script Execution
```bash
# Inline C# script
TabularEditor.exe Model.bim -S "Info(Model.Name);"

# Script file
TabularEditor.exe Model.bim -S script.csx

# Multiple scripts (executed in order)
TabularEditor.exe Model.bim -S script1.csx -S script2.csx
```

### Deployment
```bash
# Deploy to XMLA endpoint
TabularEditor.exe Model.bim -D "server" "database"

# Deploy with options
TabularEditor.exe Model.bim -D "server" "database" -O -C -P -R -M -E -V -W
```

### Deployment Options

| Flag | Description |
|------|-------------|
| `-O` | Overwrite existing database |
| `-C` | Create database if not exists |
| `-P` | Partition/data sources only (no structure) |
| `-R` | Replace roles only |
| `-M` | Replace role members only |
| `-E` | Deploy partitions using server names (incremental refresh) |
| `-V` | Verbose mode |
| `-W` | Warning mode (warnings as errors) |

### Save Output
```bash
# Save to model.bim
TabularEditor.exe Model.bim -S script.csx -B Output.bim

# Save to TMDL folder
TabularEditor.exe Model.bim -S script.csx -T output/

# Save to PBIP format (TE3 only)
TabularEditor.exe Model.bim -S script.csx -PBIP output.pbip
```

### Best Practice Analyzer
```bash
# Run BPA rules
TabularEditor.exe Model.bim -A rules.json

# Run BPA with output file
TabularEditor.exe Model.bim -A rules.json -G results.sarif

# Fail on specific severity
TabularEditor.exe Model.bim -A rules.json -W  # Warnings as errors
```

### Schema Comparison
```bash
# Compare source to target
TabularEditor.exe SourceModel.bim -DIFF "server" "database" -DIFFOUTPUT changes.json
```


## Common Operations

### 1. Deploy Local Model to Service
```bash
TabularEditor.exe Model.bim ^
    -D "powerbi://api.powerbi.com/v1.0/myorg/Workspace" "SemanticModel" ^
    -O -C
```

### 2. Run Script and Save
```bash
TabularEditor.exe Model.bim -S format-dax.csx -B Model.bim
```

### 3. Run BPA Analysis
```bash
TabularEditor.exe Model.bim ^
    -A https://raw.githubusercontent.com/microsoft/Analysis-Services/master/BestPracticeRules/BPARules.json ^
    -G bpa-results.sarif
```

### 4. Refresh Model Data
```bash
TabularEditor.exe "server" "database" ^
    -S "Model.RequestRefresh(RefreshType.Full);" ^
    -D "server" "database"
```

### 5. Export Model from Service
```bash
TabularEditor.exe "powerbi://api.powerbi.com/v1.0/myorg/Workspace" "Model" ^
    -T output/definition
```


## Authentication

### Windows Authentication (Default)
Used automatically for on-premises SSAS.

### Service Principal (Azure AD App)
Set environment variables:
```bash
set AZURE_CLIENT_ID=your-app-id
set AZURE_TENANT_ID=your-tenant-id
set AZURE_CLIENT_SECRET=your-secret
```

Connection string format:
```
Provider=MSOLAP;
Data Source=powerbi://api.powerbi.com/v1.0/myorg/Workspace;
User ID=app:CLIENT_ID@TENANT_ID;
Password=CLIENT_SECRET
```

### Interactive (TE3 Only)
```bash
TabularEditor.exe "server" "database" --auth interactive
```


## CI/CD Integration

### Azure DevOps Pipeline
```yaml
steps:
  - task: PowerShell@2
    displayName: 'Deploy Semantic Model'
    inputs:
      targetType: 'inline'
      script: |
        TabularEditor.exe "$(Build.SourcesDirectory)/Model.bim" `
          -D "$(XMLA_ENDPOINT)" "$(MODEL_NAME)" -O -C
```

### GitHub Actions
```yaml
jobs:
  deploy:
    runs-on: windows-latest
    steps:
      - name: Deploy Model
        run: |
          TabularEditor.exe Model.bim -D "${{ secrets.XMLA_ENDPOINT }}" "ModelName" -O -C
```


## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Script error or deployment failure |
| 2 | BPA rule violations (when -W used) |


## File Formats

### Input Formats
- `model.bim` - Tabular JSON (legacy)
- `definition/` - TMDL folder (modern)
- `*.pbip` - Power BI Project (TE3)

### Output Formats

| Flag | Format | Description |
|------|--------|-------------|
| `-B` | `.bim` | Tabular JSON |
| `-T` | folder | TMDL |
| `-PBIP` | `.pbip` | Power BI Project (TE3) |


## Troubleshooting

### "Database not found"
- Check server/workspace name is exact
- Verify you have access to the workspace
- Ensure XMLA endpoint is enabled

### "Authentication failed"
- Verify environment variables are set correctly
- Check service principal has workspace access
- Confirm API permissions are granted

### "Script execution failed"
- Check C# syntax is valid
- Verify all referenced objects exist
- Add Info() statements to debug


## Quick Reference Card

```
+---------------------------------------------------------+
| TABULAR EDITOR CLI QUICK REFERENCE                      |
+---------------------------------------------------------+
| SOURCES                                                 |
|   Model.bim           Local JSON model                  |
|   definition/         TMDL folder                       |
|   "server" "db"       XMLA connection                   |
+---------------------------------------------------------+
| SCRIPTS                                                 |
|   -S "code"           Inline C# script                  |
|   -S file.csx         Script file                       |
+---------------------------------------------------------+
| DEPLOYMENT                                              |
|   -D "server" "db"    Deploy to target                  |
|   -O                  Overwrite existing                |
|   -C                  Create if not exists              |
+---------------------------------------------------------+
| OUTPUT                                                  |
|   -B output.bim       Save as JSON                      |
|   -T folder/          Save as TMDL                      |
+---------------------------------------------------------+
| BPA                                                     |
|   -A rules.json       Run BPA analysis                  |
|   -G results.sarif    Output BPA results                |
+---------------------------------------------------------+
```


## References

- [TE2 CLI Documentation](https://docs.tabulareditor.com/te2/Command-line-Options.html)
- [TE3 CLI Documentation](https://docs.tabulareditor.com/te3/other/command-line-options.html)
- [XMLA Endpoints](https://learn.microsoft.com/en-us/power-bi/enterprise/service-premium-connect-tools)
