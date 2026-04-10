# pbiviz MCP server

`powerbi-visuals-tools` ships an MCP server that grounds custom-visual work in
current API docs, best practices, and certification checks. This plugin already
registers it (`plugins/custom-visuals/.mcp.json`), so it starts when the plugin
is enabled. The sections below cover standalone setup and each tool.

## Start it

```bash
pbiviz mcp
# or
npx -y powerbi-visuals-tools mcp
```

Prerequisites: Node.js 20.19 or later and an MCP-capable client.

## Standalone client config (outside this plugin)

For a visual project edited in VS Code or Cursor without this plugin, add the
server to the editor's MCP config. A ready file is at `examples/vscode-mcp.json`.

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "pbiviz": { "command": "npx", "args": ["-y", "powerbi-visuals-tools", "mcp"] }
  }
}
```

Cursor (`~/.cursor/mcp.json`) uses the same server under an `mcpServers` key.

## Tools

```yaml
get_available_apis:
  Documents data, formatting, interaction, and utility APIs with examples.
  Use before writing dataView access or formatting code.
get_best_practices:
  Guidelines for API-version management, performance, security, accessibility,
  project structure, and testing.
add_feature:
  Lists features available to add (bookmarks, tooltips, drill-down, selection,
  context menu, localization, and more).
implement_feature:
  Step-by-step instructions, code templates, and configuration changes to wire a
  chosen feature into the project.
list_visual_info:
  Extracts the project's metadata: GUID, version, author, data roles, dependencies.
check_vulnerabilities:
  Scans dependencies and source for risky patterns (eval, innerHTML and similar).
prepare_certification:
  Checks required files (pbiviz.json, capabilities.json, package.json), visual
  configuration, capabilities, and assets before an AppSource submission.
```

## How to use it during development

- Start a new visual: `get_best_practices`, then `get_available_apis` for the data
  and formatting APIs the design needs
- Add interactivity: `add_feature` to see options, then `implement_feature` for the
  exact wiring (selection manager, tooltip service, bookmarks)
- Before packaging for distribution: `check_vulnerabilities`, then `prepare_certification`
  to catch missing files or unsafe calls early
