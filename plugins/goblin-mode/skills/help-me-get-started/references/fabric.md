# Cloud and Fabric service tools

For the `fabric-cli`, `fabric-admin`, and `etl` plugins, and the cloud operations of `semantic-models` and `reports`. Every tool here runs natively on Windows and macOS. Install the base layer (`references/foundation.md`) first, since these depend on `uv` and `az`.

## fab (Fabric CLI)

The workhorse for anything remote in Power BI or Fabric: workspaces, items, `fab api`, ACLs, jobs, export/import. It works on Power BI Pro, PPU, or Fabric; you do not need a Fabric SKU to use the CLI.

```bash
# Windows and macOS (same package)
uv tool install ms-fabric-cli

# keep it current
uv tool upgrade ms-fabric-cli
```

Authenticate, then confirm:

```bash
fab auth login
fab auth status
```

Discover the command surface with `fab --help` and `fab <command> --help` rather than assuming flags; it changes often. Docs: [microsoft.github.io/fabric-cli](https://microsoft.github.io/fabric-cli/).

## az (Azure CLI)

Mints the access tokens the query tools and scripts use (DuckDB over OneLake, sqlcmd, Livy/Spark, the fabric-sql MCP, `pbir usage`, lineage). Also drives Azure infrastructure and Graph.

```bash
# Windows
winget install Microsoft.AzureCLI

# macOS
brew install azure-cli
```

Authenticate:

```bash
az login
```

Service principal login, for CI or unattended runs:

```bash
az login --service-principal -u <appId> -t <tenantId> --password "$(az keyvault secret show ...)"
```

Version note: `az fabric capacity` commands need Azure CLI 2.61.0 or later (`az version` to check). Tenant-settings security-group audits (fabric-admin) need Graph permissions `Group.Read.All`, `User.Read.All`, `Directory.Read.All`, `RoleManagement.Read.Directory`.

### microsoft-fabric extension (optional)

Only for Fabric capacity lifecycle (create, scale, suspend, resume) from `az`:

```bash
az extension add --name microsoft-fabric
az provider register --namespace Microsoft.Fabric   # first time only
```

## MCP servers

Two HTTP MCP servers ship configured in the `fabric-cli` plugin (`plugins/fabric-cli/.mcp.json`); they start with the plugin. A third serves custom-visuals.

### microsoft-learn (public, no auth)

Grounds answers in current Microsoft docs (`microsoft_docs_search`, `microsoft_docs_fetch`). Config, already bundled:

```json
{ "type": "http", "url": "https://learn.microsoft.com/api/mcp" }
```

Nothing to install or authenticate.

### fabric-sql (needs a bearer token)

Server-side T-SQL against Fabric SQL endpoints. Interactive OAuth over `/mcp` does not work (Entra refuses dynamic client registration), so export a bearer token into `FABRIC_PBI_TOKEN` before launching the agent:

```bash
export FABRIC_PBI_TOKEN="$(az account get-access-token \
  --resource https://analysis.windows.net/powerbi/api \
  --query accessToken -o tsv)"
```

The token expires in about an hour; re-export it and restart the agent when queries start returning auth errors. To add the server to a project manually:

```bash
claude mcp add --transport http --scope project fabric-sql \
  https://api.fabric.microsoft.com/v1/mcp/dataPlane/sqlEndpoint
```

For a self-refreshing setup, register an Entra public-client app and pass `--client-id` / `--callback-port` instead of the static token.

### pbiviz (custom-visuals)

A stdio MCP for custom-visual development, run through Node. Bundled in the `custom-visuals` plugin; needs Node.js 20.19+ (see `references/foundation.md`):

```json
{ "command": "npx", "args": ["-y", "powerbi-visuals-tools", "mcp"] }
```

## DuckDB (lakehouse and file queries)

Queries Delta tables and raw files over OneLake, both locally and in Fabric notebooks. Used by `etl` and the `fabric-cli` query scripts.

```bash
# Windows
winget install DuckDB.cli

# macOS
brew install duckdb
```

One-time setup for OneLake access (uses your `az login`):

```sql
INSTALL delta; INSTALL azure;
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
```

DuckDB reads Delta; writes go through Spark.

## sqlcmd (go-sqlcmd)

T-SQL against the lakehouse SQL endpoint, warehouse, or SQL database. Version 1.9.0 or later.

```bash
# Windows
winget install --id Microsoft.Sqlcmd

# macOS
brew install sqlcmd
```

Auth reuses `az login` via `--authentication-method ActiveDirectoryAzCli`; endpoint discovery uses `fab auth login`. Needs at least Viewer on the workspace plus Read on the SQL object.

## nb (Fabric Notebook CLI, optional)

Notebook CRUD, cell execution, and notebook-less Spark runs; an alternative to raw Livy. Two install routes:

```bash
# Prebuilt binary: download from the releases page and put it on PATH
#   https://github.com/data-goblin/nb-cli/releases

# From source (needs the Rust toolchain)
cargo install nb-fabric
```

Rust toolchain, if building from source:

```bash
winget install Rustlang.Rustup                                     # Windows
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh     # macOS/Linux
```

`nb` needs `az login`. Verify: `nb --version`, `nb auth status`.

## Spark / Livy (etl)

Nothing installs locally; this is a Fabric service endpoint for ephemeral PySpark/Python runs. It needs a Fabric capacity (F SKU or trial) and a lakehouse in the target workspace. Tokens come from `az`, and note that `fab` tokens do not work here:

```bash
az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv
```

Always delete Livy sessions when done so they stop consuming capacity units.

## fabric-admin extras

The `fabric-admin` plugin reuses `fab` and `az` above and adds nothing new to install; its audit scripts run through `uv run` and auto-install their Python dependencies (`pyyaml`, `reportlab`). It requires the `fabric-cli` plugin, a Fabric/Power BI admin account for `fab`, and the Graph permissions listed under `az`.

## fabric-cicd (optional)

Python library for deployment pipelines, if you do CI/CD:

```bash
uv pip install fabric-cicd
```

## Capacity and SKU quick reference

```
fab CLI, DuckDB, sqlcmd, fabric-sql   Pro / PPU / Fabric; no Fabric SKU needed for the CLI itself
Spark / Livy (etl)                    Fabric capacity (F SKU or trial) + a lakehouse
Enhanced refresh (targeted tables)    Premium / PPU / Fabric; Pro does full-model refresh only
Trusted workspace access to ADLS      F SKU (not Trial)
```
