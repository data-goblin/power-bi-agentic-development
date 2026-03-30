# Authentication & CI/CD Integration

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

## Troubleshooting

### "Database not found"

- Check server/workspace name is exact
- Verify access to the workspace
- Ensure XMLA endpoint is enabled

### "Authentication failed"

- Verify environment variables are set correctly
- Check service principal has workspace access
- Confirm API permissions are granted

### "Script execution failed"

- Check C# syntax is valid
- Verify all referenced objects exist
- Add Info() statements to debug
