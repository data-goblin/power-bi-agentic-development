# Tabular Editor 3 Configuration Schemas

> **Temporary Location:** These schemas are stored here temporarily until a dedicated schemas repository is available.

## Schemas

| Schema | Validates | Purpose |
|--------|-----------|---------|
| `preferences-schema.json` | `Preferences.json` | Application preferences |
| `uipreferences-schema.json` | `UiPreferences.json` | UI settings, keyboard shortcuts |
| `layouts-schema.json` | `Layouts.json` | Window layout configurations |
| `recentfiles-schema.json` | `RecentFiles.json` | Recent files/models history |
| `recentservers-schema.json` | `RecentServers.json` | Server connection history |
| `tmuo-schema.json` | `*.tmuo` | Model-level user options |

## Usage

```bash
# Using the provided Python script
python scripts/validate_config.py Preferences.json
python scripts/validate_config.py --type tmuo MyModel.JohnDoe.tmuo

# Using ajv-cli
ajv validate -s schema/preferences-schema.json -d Preferences.json

# Using check-jsonschema
check-jsonschema --schemafile schema/tmuo-schema.json Model.Username.tmuo
```

## File Locations

- **Application configs:** `%LocalAppData%\TabularEditor3\`
- **TMUO files:** Alongside model files as `<ModelFileName>.<WindowsUserName>.tmuo`

## Important Notes

- TMUO files contain encrypted credentials tied to Windows user accounts - cannot be shared
- Add `*.tmuo` to `.gitignore` to prevent accidental commits
- Application configs (Preferences, UiPreferences, Layouts) can be shared between users
