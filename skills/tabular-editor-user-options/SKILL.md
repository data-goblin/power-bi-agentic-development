---
name: tabular-editor-user-options
description: This skill should be used when the user asks about ".tmuo files", "Tabular Editor user options", "workspace database settings", "deployment preferences", "data source overrides", "table import settings", or "per-model TE3 configuration". Provides guidance for understanding and configuring Tabular Editor 3 user options files.
---

# Tabular Editor User Options (.tmuo)

Expert guidance for understanding and configuring Tabular Editor 3 user options files for Power BI semantic model development.

## When to Use This Skill

Activate automatically when tasks involve:

- Understanding .tmuo file structure and purpose
- Configuring workspace database connections
- Setting up deployment preferences
- Managing data source overrides for development
- Configuring table import settings
- Troubleshooting credential encryption issues

## Critical

- TMUO files contain user-specific settings - **never commit to version control**
- Credentials are encrypted with Windows User Key - **cannot be shared between users**
- Add `*.tmuo` to `.gitignore` in all projects
- Each developer needs their own .tmuo file

## About TMUO Files

- Introduced in Tabular Editor 3 for storing developer- and model-specific preferences
- Created automatically when opening a Model.bim or Database.json file
- Contains workspace, deployment, and data source settings

## File Location

TMUO files are stored **alongside the model file** with a user-specific name:

| Component | Value |
|-----------|-------|
| **Location** | Same directory as model.bim or Database.json |
| **Naming** | `<ModelFileName>.<WindowsUserName>.tmuo` |
| **Example** | `AdventureWorks.bim` + user `JohnDoe` = `AdventureWorks.JohnDoe.tmuo` |

**Important:**
- One .tmuo file per model per user
- Never commit to version control (add `*.tmuo` to `.gitignore`)
- Credentials are encrypted with Windows User Key - cannot be shared between users
- Each developer creates their own .tmuo automatically when opening the model

## Quick Reference

### TMUO JSON Structure

| Section | Purpose |
|---------|---------|
| `UseWorkspace` | Whether to use workspace database |
| `WorkspaceConnection` | Server for workspace database |
| `WorkspaceDatabase` | Name of workspace database |
| `Deployment` | Target server and deployment options |
| `DataSourceOverrides` | Override connection strings for workspace |
| `TableImportSettings` | Settings for Import Tables feature |
| `RefreshOverrides` | Advanced refresh configuration |

```json
{
  "UseWorkspace": true,
  "WorkspaceConnection": "localhost",
  "WorkspaceDatabase": "MyModel_Workspace_JohnDoe",
  "Deployment": {
    "TargetConnectionString": "powerbi://api.powerbi.com/v1.0/myorg/Workspace",
    "TargetDatabase": "MyModel",
    "DeployPartitions": false,
    "DeployModelRoles": true
  },
  "DataSourceOverrides": {
    "SQL Server": {
      "ConnectionString": "Data Source=localhost;Initial Catalog=DevDB"
    }
  }
}
```

### Workspace Settings

Control workspace database behavior:

| Field | Type | Description |
|-------|------|-------------|
| `UseWorkspace` | bool | Enable/disable workspace mode |
| `WorkspaceConnection` | string/object | Server connection (plain or encrypted) |
| `WorkspaceDatabase` | string | Database name (should be unique per developer/model) |

```json
{
  "UseWorkspace": true,
  "WorkspaceConnection": "provider=MSOLAP;data source=localhost",
  "WorkspaceDatabase": "AdventureWorks_Workspace_JohnDoe_20240115"
}
```

### Deployment Settings

Configure deployment target and options:

| Field | Type | Description |
|-------|------|-------------|
| `TargetConnectionString` | string/object | Target server connection |
| `TargetDatabase` | string | Target database name |
| `DeployDataSources` | bool | Deploy data source definitions |
| `DeployPartitions` | bool | Deploy partition definitions |
| `DeployRefreshPolicyPartitions` | bool | Deploy incremental refresh partitions |
| `DeployModelRoles` | bool | Deploy security roles |
| `DeployModelRoleMembers` | bool | Deploy role members |
| `DeploySharedExpressions` | bool | Deploy shared M expressions |

```json
{
  "Deployment": {
    "TargetConnectionString": "powerbi://api.powerbi.com/v1.0/myorg/Production",
    "TargetDatabase": "Sales Analytics",
    "DeployDataSources": false,
    "DeployPartitions": false,
    "DeployRefreshPolicyPartitions": true,
    "DeployModelRoles": true,
    "DeployModelRoleMembers": false,
    "DeploySharedExpressions": true
  }
}
```

### Data Source Overrides

Override data source connections for workspace database:

| Field | Type | Description |
|-------|------|-------------|
| `ImpersonationMode` | enum | Authentication mode |
| `Username` | string | Username for authentication |
| `ConnectionString` | string/object | Override connection string |
| `Password` | string/object | Password (can be encrypted) |
| `AccountKey` | string/object | Azure storage account key |
| `PrivacySetting` | string | Privacy level |

**ImpersonationMode values:**
- `Default`
- `ImpersonateAccount`
- `ImpersonateAnonymous`
- `ImpersonateCurrentUser`
- `ImpersonateServiceAccount`
- `ImpersonateUnattendedAccount`

```json
{
  "DataSourceOverrides": {
    "SQL Server DW": {
      "ImpersonationMode": "ImpersonateServiceAccount",
      "ConnectionString": "Data Source=dev-server;Initial Catalog=DevDW"
    },
    "Azure Blob": {
      "AccountKey": {
        "Encryption": "UserKey",
        "EncryptedString": "ABC123..."
      }
    }
  }
}
```

### Table Import Settings

Settings for the Import Tables / Schema Update feature:

| Field | Type | Description |
|-------|------|-------------|
| `ServerType` | enum | Database type |
| `UserId` | string | Username |
| `Password` | string/object | Password (plain or encrypted) |
| `Options` | object | Additional server-specific options |

**ServerType values:**
- `Sql`, `Oracle`, `Odbc`, `OleDb`, `Snowflake`, `Dataflow`
- `PostgreSql`, `MySql`, `MariaDb`, `Db2`, `Databricks`, `OneLake`

```json
{
  "TableImportSettings": {
    "Sales Data": {
      "ServerType": "Sql",
      "UserId": "sqladmin",
      "Password": {
        "Encryption": "UserKey",
        "EncryptedString": "..."
      }
    }
  }
}
```

### Encrypted Credentials

Credentials can be stored encrypted using Windows User Key:

```json
{
  "ConnectionString": {
    "Encryption": "UserKey",
    "EncryptedString": "ABC123..."
  }
}
```

Or for deployment targets:

```json
{
  "TargetConnectionString": {
    "ConnectionString": "powerbi://...",
    "EncryptedCredentials": "XYZ789..."
  }
}
```

**Note:** Encrypted strings are tied to the Windows user account and cannot be shared.

## File Naming Convention

```
<ModelFileName>.<WindowsUserName>.tmuo
```

Examples:
- `Model.bim` opened by `JohnDoe` -> `Model.JohnDoe.tmuo`
- `AdventureWorks.bim` opened by `jane.smith` -> `AdventureWorks.jane.smith.tmuo`

## Common Patterns

### Development Environment Setup

```json
{
  "UseWorkspace": true,
  "WorkspaceConnection": "localhost",
  "WorkspaceDatabase": "Dev_AdventureWorks",
  "DataSourceOverrides": {
    "Production SQL": {
      "ConnectionString": "Data Source=dev-sql;Initial Catalog=DevDB"
    }
  }
}
```

### Power BI Service Deployment

```json
{
  "Deployment": {
    "TargetConnectionString": "powerbi://api.powerbi.com/v1.0/myorg/MyWorkspace",
    "TargetDatabase": "Sales Model",
    "DeployPartitions": false,
    "DeployModelRoles": true
  }
}
```

## Additional Resources

### Reference Files

- **`schema/tmuo-schema.json`** - JSON Schema for validating .tmuo files *(temporary location)*

### Scripts

- **`scripts/validate_tmuo.py`** - Validate TMUO files for schema compliance

### External References

- [Tabular Editor User Options](https://docs.tabulareditor.com/references/user-options.html)
- [Workspace Mode](https://docs.tabulareditor.com/features/workspace-mode.partial.html)
- [Supported File Types](https://docs.tabulareditor.com/references/supported-files.html)

## Best Practices

1. **Never commit .tmuo files** - Add `*.tmuo` to `.gitignore`
2. **Use unique workspace database names** - Include username and timestamp
3. **Don't share encrypted credentials** - They're tied to Windows account
4. **Use data source overrides** - Point to dev/test environments
5. **Document expected settings** - Create a template README for team
