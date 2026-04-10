---
name: te2-cli
version: 0.22.3
description: CLI syntax reference for Tabular Editor 2 (TabularEditor.exe); deployment, scripting, BPA analysis, and CI/CD integration. Automatically invoke when the user mentions "TabularEditor.exe", TE2 CLI flags (-D, -S, -A, -B, -TMDL, -O, -C), or asks to "deploy a model via CLI", "set up CI/CD for Power BI", "automate model deployment", "run BPA from command line", "save model as TMDL".
---

# Tabular Editor 2 CLI

Command-line interface for Tabular Editor 2 (TE2). This skill covers the `TabularEditor.exe` executable; TE3 has its own CLI and is a separate product.


## Installation

### Tabular Editor 2 (Free)
- Download: https://github.com/TabularEditor/TabularEditor/releases
- Extract to preferred location or use Chocolatey: `choco install tabulareditor2`

## Executable

`TabularEditor.exe` -- free, Windows-only. For Mac/Linux, run via a Windows VM or container.


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

| Flag | Long Form | Description |
|------|-----------|-------------|
| `-O` | `-OVERWRITE` | Overwrite existing database |
| `-C` | `-CONNECTIONS` | Deploy/overwrite data sources (supports connection string placeholder substitution) |
| `-P` | `-PARTITIONS` | Deploy/overwrite existing table partitions |
| `-R` | `-ROLES` | Deploy roles |
| `-M` | `-MEMBERS` | Deploy role members |
| `-S` | `-SHARED` | Deploy shared expressions (within `-D` context; note: `-S` also means script outside `-D`) |
| `-E` | `-ERR` | Return non-zero exit code if AS returns error messages after deployment |
| `-V` | `-VSTS` | Output Azure DevOps logging commands |
| `-W` | `-WARN` | Output warnings for unprocessed objects |
| `-F` | `-FULL` | Full deployment (equivalent to `-O -C -P -S -R -M`) |
| `-X` | `-XMLA` | Generate XMLA/TMSL script instead of deploying |
| `-L` | `-LOGIN` | Disable integrated security for deployment |
| `-Y` | `-SKIPPOLICY` | Skip incremental refresh policy partitions |

### Save Output
```bash
# Save to model.bim
TabularEditor.exe Model.bim -S script.csx -B Output.bim

# Save to TMDL folder
TabularEditor.exe Model.bim -S script.csx -TMDL output/

# Save to legacy folder structure
TabularEditor.exe Model.bim -S script.csx -F output/
```

### Best Practice Analyzer
```bash
# Run BPA rules
TabularEditor.exe Model.bim -A rules.json

# Run BPA with Azure DevOps logging output
TabularEditor.exe Model.bim -A rules.json -V

# Run BPA with GitHub Actions logging output
TabularEditor.exe Model.bim -A rules.json -G

# Analyze excluding rules embedded in model annotations
TabularEditor.exe Model.bim -AX rules.json
```

### Schema Check
```bash
# Validate data source schemas against the model
TabularEditor.exe Model.bim -SC
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
    -V
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
    -TMDL output/definition
```


## Authentication

For authentication methods (Windows, Service Principal, Interactive) and CI/CD integration (Azure DevOps, GitHub Actions), see **`references/auth-and-cicd.md`**.


## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Any error-level output (script error, deployment failure, BPA violations at severity >= 3) |


## File Formats

### Input Formats
- `model.bim` - Tabular JSON (legacy)
- `definition/` - TMDL folder (modern)
- `*.pbip` - Power BI Project (TE3)

### Output Formats

| Flag | Format | Description |
|------|--------|-------------|
| `-B` | `.bim` | Tabular JSON |
| `-TMDL` | folder | TMDL |
| `-F` | folder | Legacy folder structure |


## Troubleshooting

For common errors (database not found, authentication failed, script execution failed), see **`references/auth-and-cicd.md`**.


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
|   -TMDL folder/       Save as TMDL                      |
+---------------------------------------------------------+
| BPA                                                     |
|   -A rules.json       Run BPA analysis                  |
|   -G results.sarif    Output BPA results                |
+---------------------------------------------------------+
```


## References

To retrieve current XMLA and deployment docs, use `microsoft_docs_search` + `microsoft_docs_fetch` (MCP) if available, otherwise `mslearn search` + `mslearn fetch` (CLI). Search based on the user's request and run multiple searches as needed to ensure sufficient context before proceeding.

- [TE2 CLI Documentation](https://docs.tabulareditor.com/features/Command-line-Options.html)
- [XMLA Endpoints](https://learn.microsoft.com/en-us/power-bi/enterprise/service-premium-connect-tools)
