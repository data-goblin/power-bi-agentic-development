# pbiviz toolchain reference

The `pbiviz` CLI ships in the `powerbi-visuals-tools` npm package. Run any command
with `npx -y powerbi-visuals-tools <command>` or a global install.

## CLI commands

```yaml
pbiviz new <Name>:        scaffold a new visual project
pbiviz start:             compile and serve for live preview (developer visual picks it up)
pbiviz package:           build the .pbiviz into dist/
pbiviz package --certification-audit:  flag unsafe fetch / XMLHttpRequest / eval calls
pbiviz package --certification-fix:     rebuild stripping forbidden library calls (libraries only)
pbiviz info:              print the current project's metadata
pbiviz mcp:               start the pbiviz MCP server (see mcp-server.md)
pbiviz install-cert:      install the SSL certificate that live preview needs
```

After `pbiviz package --certification-fix`, update the `npm run package` script so the
package hash matches at certification review.

## Project structure

```dirtree
MyVisual/
  pbiviz.json            visual metadata: visualClassName, displayName, guid, author, supportUrl, gitHubUrl
  capabilities.json      data roles, dataView mappings, formatting objects, feature flags
  package.json           dependencies + scripts (must expose an eslint script for certification)
  tsconfig.json          TypeScript config
  src/
    visual.ts            the IVisual implementation (class name == visualClassName)
    settings.ts          formatting settings model (optional split)
  style/
    visual.less          styles
  assets/
    icon.png             20x20 visuals-pane icon
```

`node_modules`, `.tmp`, and `dist` stay out of source control (add to `.gitignore`);
certification rejects a repo that commits them.

## IVisual lifecycle

Every visual is a class implementing `IVisual`. Exactly one such class per project.

```typescript
export class Visual implements IVisual {
    constructor(options: VisualConstructorOptions) {
        // create the root element, instantiate services (selection, tooltip, formatting)
    }
    public update(options: VisualUpdateOptions): void {
        // read options.dataViews, options.viewport, then render
    }
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // return the format-pane model (API v5+; replaces enumerateObjectInstances)
    }
    public destroy(): void {
        // optional cleanup
    }
}
```

`update` fires on new data, resize, filter, cross-highlight, and bookmark application.
Branch on `options.type` when the work differs by trigger.

## capabilities.json essentials

```yaml
dataRoles:        the field wells; each has name, kind (Grouping | Measure | GroupingOrMeasure), displayName
dataViewMappings: how roles populate the dataView (categorical, table, matrix, single); set conditions for min/max fields
objects:          format-pane properties; each object holds typed properties (text, numeric, bool, fill, ...)
privileges:       required permissions (WebAccess, ExportContent, LocalStorage); empty array when none
```

Opt-in capability flags worth knowing: `supportsHighlight`, `supportsKeyboardFocus`,
`sorting`, `drilldown`, `tooltips`, `supportsLandingPage`, `advancedEditModeSupport`.
`get_available_apis` from the MCP returns the current type details for each.

## Formatting model

Build the format pane with `powerbi-visuals-utils-formattingmodel`:

```typescript
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
```

- A `Model` holds `cards`; a card maps to a `capabilities.json` object (card name == object name)
- A slice maps to a property (slice name == property name)
- Hide cards, groups, or slices dynamically with `visible: false`
- Set `analyticsPane: true` to place a card on the analytics pane instead of format

## Key npm packages

```yaml
powerbi-visuals-api:                  the IVisual / dataView / formatting type contracts (pin to the host API version)
powerbi-visuals-tools:                the pbiviz CLI and its MCP server
powerbi-visuals-utils-formattingmodel: build the format pane
powerbi-visuals-utils-chartutils / -dataviewutils / -svgutils / -typeutils / -interactivityutils / -tooltiputils: helpers
eslint-plugin-powerbi-visuals:        the lint config certification requires
```
