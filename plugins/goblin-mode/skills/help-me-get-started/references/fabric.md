# Cloud and Fabric service tools

For the `fabric-cli`, `fabric-admin`, and `etl` plugins, and the cloud operations of `semantic-models` and `reports`. Every tool here runs natively on Windows, macOS and Linux. Install the base layer (`references/foundation.md`) first, since these depend on `uv` and `az`.

## fab (Fabric CLI)

The workhorse for anything remote in Power BI or Fabric: workspaces, items, `fab api`, ACLs, jobs, export/import. It works on Power BI Pro, PPU, or Fabric; you do not need a Fabric SKU to use the CLI.

```bash
# Any OS (same package)
uv tool install ms-fabric-cli

# keep it current
uv tool upgrade ms-fabric-cli
```

Authenticate, then confirm:

```bash
fab auth login
fab auth status
```

Discover the command surface with `fab --help` and `fab <command> --help` rather than assuming flags; it changes often. Newer item types need newer fab: Ontology and GraphModel from 1.8.0, Plan and WarehouseSnapshot from 1.9.0. Docs: [microsoft.github.io/fabric-cli](https://microsoft.github.io/fabric-cli/).

## az (Azure CLI)

Mints the access tokens the query tools and scripts use (DuckDB over OneLake, sqlcmd, Livy/Spark, the fabric-sql MCP, `pbir usage`, lineage). Also drives Azure infrastructure and Graph.

```bash
# Windows
winget install Microsoft.AzureCLI

# macOS
brew install azure-cli

# Arch Linux
sudo pacman -S azure-cli
```

Debian and Ubuntu: follow https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux (adds Microsoft's apt repository).

Authenticate:

```bash
az login
```

Service principal login, for CI or unattended runs:

```bash
az login --service-principal -u <appId> -t <tenantId> --password "$(az keyvault secret show ...)"
```

Tenant-settings security-group audits (fabric-admin) need Graph permissions `Group.Read.All`, `User.Read.All`, `Directory.Read.All`, `RoleManagement.Read.Directory`.

### microsoft-fabric extension (optional)

Only for Fabric capacity lifecycle (create, scale, suspend, resume) from `az`:

```bash
az extension add --name microsoft-fabric
az provider register --namespace Microsoft.Fabric   # first time only
```

## MCP servers

The `fabric-cli` plugin ships no MCP servers; `fabric-sql` is optional and registered by hand. Microsoft also hosts Fabric MCP servers that can supersede it: check the connectors in the user's Claude account before registering this one. The `custom-visuals` plugin bundles `pbiviz`.

### fabric-sql (needs a bearer token)

Server-side T-SQL against Fabric SQL endpoints. Interactive OAuth over `/mcp` does not work (Unverified: Entra refused dynamic client registration when this was written), so export a bearer token into `FABRIC_PBI_TOKEN` before launching the agent:

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

# Arch Linux
sudo pacman -S duckdb
```

Other Linux distributions: https://duckdb.org/install/. The `delta` and `azure` extensions autoload on first use. OneLake access uses your `az login`:

```sql
CREATE SECRET (TYPE azure, PROVIDER credential_chain, CHAIN 'cli');
```

DuckDB 2.0 reads Delta and can create and append to Delta tables (UPDATE, DELETE and MERGE still go through Spark); see the `using-duckdb` skill.

## sqlcmd (go-sqlcmd)

T-SQL against the lakehouse SQL endpoint, warehouse, or SQL database. Version 1.9.0 or later.

```bash
# Windows
winget install --id Microsoft.Sqlcmd

# macOS
brew install sqlcmd
```

Linux: https://learn.microsoft.com/en-us/sql/tools/sqlcmd/go-sqlcmd-utility (install section).

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
see https://rustup.rs                                            # macOS/Linux
```

`nb` needs `az login`. Verify: `nb --version`, `nb auth status`.

## Spark / Livy (etl)

Nothing installs locally; this is a Fabric service endpoint for ephemeral PySpark/Python runs. It needs a Fabric capacity (F SKU or trial), a lakehouse in the target workspace, and an Entra token with the `Lakehouse.*` and `Code.Access*` scopes (see the `executing-spark` skill). Delete Livy sessions when done so they stop consuming capacity units.

## fabric-admin extras

The `fabric-admin` plugin reuses `fab` and `az` above and adds nothing new to install; its audit scripts run through `uv run` and resolve their pinned Python dependencies (`pyyaml`, `reportlab`) from a PEP 723 header. It requires the `fabric-cli` plugin, a Fabric/Power BI admin account for `fab`, and the Graph permissions listed under `az`.

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
