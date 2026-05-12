# What's new in fab CLI

Per-version notes for releases relevant to this skill. Source: [official release notes](https://microsoft.github.io/fabric-cli/release-notes/).

## 1.6.1 (2026-04-29)

- **`fab find`** ; search the OneLake catalog across every workspace the user can see. Substring on name, description, workspace; `-P type=X` or `type=[X,Y]` to filter, `-P type!=X` to exclude, `-l` for ids, `-q '<jmespath>'` for client-side filter/projection, `--output_format json` for machine-readable output. See [workspaces.md](./workspaces.md#cross-workspace-search) for usage and the delta vs `search_across_workspaces.py`.
- **VariableLibrary** promoted from portal-only to full API support
- **`fab rm --hard`** permanent delete (skips recycle bin)
- **Lakehouse import/export** added
- **Map** and **DigitalTwinBuilder** item types added to export/import

## 1.5.0 (2026-03-12)

- **`fab deploy`** integrates with the [fabric-cicd](https://github.com/microsoft/fabric-cicd) library for CI/CD flows. Replaces hand-rolled deploy scripts for most cases.
- **`fab export` / `fab import`** support added for Semantic Model and Spark job definitions

## 1.4.0 (2026-02-09)

- **Interactive REPL**: run `fab` with no args to enter an interactive session. Toggle persistent mode with `fab config set mode interactive`.
- **`fab export --format`** ; choose `.ipynb` or `.py` when exporting notebooks
- **`fab connection set` / `fab connection rm`** ; previously list-only; now full CRUD via CLI
- **`fab get`** ; includes the `properties` field in item metadata
- **API response data** included in command output (machine-readable hooks for scripts)
- **Login notification** when a new fab CLI version is available
- **New item types**: CosmosDBDatabase, UserDataFunction, GraphQuerySet, DigitalTwinBuilder

## Compatibility flags called out in `--help`

- **`-P, --params`** ; key=value or `key!=value` parameters; bracket syntax `key=[a,b]` for multi-value. Used by `fab find` for type filters. Other commands accept the same flag where parameters apply.
- **`-q, --query`** ; JMESPath expression for client-side filtering and projection on JSON output. Useful when piping to `jq` is heavier than needed.

## Things to retire from older workflows

- **DataHub V2 as a default search path**. `fab find` covers routine cross-workspace search. Keep [`search_across_workspaces.py`](../scripts/search_across_workspaces.py) only for governance work that needs last visit, last refresh, owner, storage mode, or capacity SKU. See [workspaces.md](./workspaces.md#cross-workspace-search) for the delta.
- **Hand-rolled deploy scripts** for moving items dev -> test -> prod; prefer `fab deploy` with fabric-cicd.
- **Manual portal steps for VariableLibrary** items; full CRUD is in the CLI now.
