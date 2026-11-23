---
name: te-docs
description: Look up Tabular Editor documentation, and work with Tabular Editor 3 per-model .tmuo user option files. Use when asked how a Tabular Editor feature works, where TE3 keeps a setting (workspace database, deployment target, data source overrides), why a .tmuo file is in Git, or to search Tabular Editor, DAX, Power BI or Fabric docs from the terminal.
---

# Tabular Editor documentation and .tmuo files

## Find an answer

1. `pbi-search` if it is installed (`pbi-search --version`): `pbi-search search "BPA rules" --source te-docs`. It searches Tabular Editor docs, DAX.guide, SQLBI, Learn and the TE blog in one call; run `pbi-search sync` once first. Install notes: `bin/README.md`
2. Otherwise fetch the page. Tabular Editor docs: https://docs.tabulareditor.com/ (the te CLI is under `/en/cli/`, references under `/en/references/`); DAX: https://dax.guide/<function>/; Learn for everything Microsoft. Old docs URLs now redirect, so follow redirects
3. Answer from the page you read, not from memory: TE3 settings and the CLI changed in 2026

The te CLI commands are the te-cli skill's job; DAX regression tests and BPA are `te test` and `te bpa`.

## .tmuo files

Per-user, per-model TE3 settings (Tabular Model User Options). Reference: [user options](https://docs.tabulareditor.com/en/references/user-options.html).

- Never commit them. Add `*.tmuo` to `.gitignore`. They hold user-specific values, and stored credentials are encrypted for one Windows user, so they cannot be shared
- Name and place: `<Model>.<UserName>.tmuo` beside a `.bim`, `.pbit` or `database.json`; `model.<UserName>.tmuo` beside `model.tmdl` or `database.tmdl` and inside a TMDL folder (TMDL always uses the `model` prefix); `database.<UserName>.tmuo` in a database.json folder. A model opened over a connection keeps its file under `%LocalAppData%\TabularEditor3\UserOptions\`
- Every property is optional and a file is written only when something is stored
- Top-level properties: `UseWorkspace`, `WorkspaceConnection` (string, or an object with `ConnectionString` and `EncryptedCredentials`), `WorkspaceDatabase`, `Deployment`, `DataSourceOverrides`, `TableImportSettings`, `RefreshOverrides`, `Permissions` (per-model AI grants), plus legacy `WorkspaceConnectionAuthMode` and `AIConsent`
- A workspace database is overwritten with the loaded model's metadata, so give each developer a unique `WorkspaceDatabase` name
- Check a file: `uv run --with jsonschema python scripts/validate_tmuo.py <file.tmuo>` (schema in `schema/tmuo-schema.json`)

Application-wide settings are not per model: `Preferences.json`, `UiPreferences.json` and `Layouts.json` live under `%LocalAppData%\TabularEditor3\`; see [preferences](https://docs.tabulareditor.com/en/references/preferences.html).
