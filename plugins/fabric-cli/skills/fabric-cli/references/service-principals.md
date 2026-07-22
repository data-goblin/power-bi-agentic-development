# Service Principals for Fabric CLI Automation

End-to-end guide for creating an Entra service principal (SP), giving it Fabric access, and authenticating `fab` as it. Use this whenever a human wants an agent, pipeline, or scheduled job to run `fab` unattended instead of through their own interactive login.

An SP for Fabric automation needs **three separate grants**, not one. Missing any of them produces a working login that still fails on every real call:

1. An Entra app registration + service principal (identity)
2. A workspace or item role via `fab acl set` (authorization on the content)
3. Membership in whichever Entra security group scopes the "service principals can use Fabric APIs" tenant setting (authorization on the API surface itself)

Skip step 3 and every `fab` call as the SP returns `[Unauthorized] Access is unauthorized`, even though the SP has a valid workspace role and a valid token. This is the single most common way SP setups fail, because it looks identical to a permissions problem on the workspace when it's actually a tenant-level gate.

## 1. Create the SP with az CLI

```bash
# App registration (the "client_id" / "app_id" everyone refers to)
APP_ID=$(az ad app create --display-name "<name>" --sign-in-audience AzureADMyOrg --query appId -o tsv)

# Service principal object backing the app - this object_id is what fab acl / group membership need
SP_OBJECT_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)

# Client secret (rotate periodically; --years defaults to 1)
CLIENT_SECRET=$(az ad app credential reset --id "$APP_ID" --display-name "<purpose-tag>" --years 1 --query password -o tsv)
```

Two different IDs come out of this and they are not interchangeable:

| ID | Where it comes from | What it's used for |
|---|---|---|
| `client_id` (a.k.a. app ID) | `az ad app create` / `az ad sp create` | Authentication (`fab auth login -u`, OAuth token requests) |
| `sp_object_id` | `az ad sp create` | Authorization (`fab acl set -I`, `az ad group member add --member-id`) |

`fab acl ls` displays the app ID in the `identity` column even though the ACL was set against the object ID underneath - don't let that make you think they're the same value, they aren't, and passing the wrong one to `az ad group member add` fails with a not-found error.

Never write the secret to a file. Pull it straight into 1Password, a Key Vault, or an env var at the point of use - see the vault/secret patterns in [fab-vs-az-cli.md](./fab-vs-az-cli.md#azure-key-vault-integration) if the target is Key Vault.

## 2. Grant workspace/item access

Same `fab acl set` used for human identities, just pointed at the SP's object ID:

```bash
fab acl set "ws.Workspace" -I "$SP_OBJECT_ID" -R Viewer -f
# or Contributor / Admin depending on what the SP needs to do
```

See [permissions.md](./permissions.md#managing-workspace-access-via-fab-acl) for the full role capability matrix (Admin/Member/Contributor/Viewer).

## 3. Clear the tenant-setting gate

The relevant tenant settings live under `admin/tenantsettings` and are usually scoped to a security group rather than open to every SP in the tenant:

```bash
fab api "admin/tenantsettings" -q "tenantSettings[?contains(settingName,'ServicePrincipal')]"
```

Look specifically for `ServicePrincipalAccessPermissionAPIs` ("Service principals can call Fabric public APIs"). If `enabled: true` but `enabledSecurityGroups` lists a group, the SP must be a member of that group:

```bash
az ad group member add --group <group-object-id> --member-id "$SP_OBJECT_ID"
az ad group member check --group <group-object-id> --member-id "$SP_OBJECT_ID"   # sanity check, returns {"value": true}
```

If the setting is disabled entirely or has no eligible group, a Fabric admin needs to enable it in Admin Portal > Tenant Settings first - this can't be done as a non-admin SP or user. Related settings worth checking the same way: `AllowServicePrincipalsUseReadAdminAPIs`, `AllowServicePrincipalsUseWriteAdminAPIs`, `AllowServicePrincipalsCreateAndUseProfiles`, `ServicePrincipalAccessGlobalAPIs` (needed if the SP will create workspaces rather than just use existing ones).

Group name is not a reliable signal of scope - a group called something like "...Admins" may only gate ordinary API-call ability, not elevated admin rights. Check what tenant setting actually references the group before assuming its blast radius from the name.

## 4. Authenticate `fab` as the SP

Two different methods, for two different situations.

### Real login (the SP's own persistent session)

```bash
fab auth login -u "$APP_ID" -p "$CLIENT_SECRET" -t <tenant-id>
```

This is what a deployed automation/agent should actually use day to day. Also supports certificate (`--certificate`), federated/OIDC token (`--federated-token`), and managed identity (`-I`) - see the Authentication Issues section in [reference.md](./reference.md#common-error-scenarios) for the full flag set.

### Env-token method (testing the SP without touching your own session)

If you're verifying a newly-created SP's permissions from your own machine, `fab auth login` overwrites the *current user's* stored fab credentials - not something you want mid-session. Instead, export three audience-specific tokens and `fab` picks them up directly without touching `~/.claude`-adjacent config or your keychain-backed login:

```bash
gettok() {
  curl -s -X POST "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token" \
    -d "client_id=$APP_ID" -d "client_secret=$CLIENT_SECRET" \
    -d "scope=$1/.default" -d "grant_type=client_credentials" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''), end='')"
}

export FAB_TOKEN=$(gettok "https://analysis.windows.net/powerbi/api")   # NOT api.fabric.microsoft.com - see gotcha below
export FAB_TOKEN_ONELAKE=$(gettok "https://storage.azure.com")
export FAB_TOKEN_AZURE=$(gettok "https://management.azure.com")

fab auth status   # should show Logged In: True, Principal ID = the SP's object id
fab ls "ws.Workspace"
```

All three env vars must be set or `fab` aborts immediately with `[UnexpectedError] FAB_TOKEN_AZURE` (or whichever var is missing) before it even tries a network call.

This is the right tool for a one-off "does this SP actually work" check run from an interactive session, precisely because it's scoped to the current process's env and doesn't persist or clobber anything.

## Gotchas

- **`FAB_TOKEN` audience must be `https://analysis.windows.net/powerbi/api`**, not `https://api.fabric.microsoft.com`. The wrong audience produces `[UnexpectedError]` with a debug-log line reading "Audience doesn't match" rather than a normal auth failure - easy to mistake for a broken secret or missing permission when it's actually just the wrong resource in the token request.
- **Freshly created client secrets need roughly 60-75 seconds to propagate** through Entra before the token endpoint accepts them. A token request failing or returning empty right after `az ad app credential reset` is propagation delay, not a bad secret - wait and retry rather than immediately regenerating.
- **`fab auth login` under a HOME override fails on macOS** with a keychain error (`-25307`) because fab's credential storage expects the real login keychain to be reachable. Don't try to sandbox a test login by faking `$HOME` - use the env-token method above instead, which has no keychain dependency.
- **A valid workspace role is not sufficient on its own.** Skipping the tenant-setting group membership (step 3) is the single most common cause of `[Unauthorized] Access is unauthorized` on an SP that otherwise looks correctly configured - the workspace ACL says it should work and the token is valid, so it's easy to burn time double-checking the wrong thing.
- **`az ad app credential reset --append`** adds a new secret without invalidating existing ones, which is the right call when testing a secret without breaking whatever is already using the app in production. Clean up test secrets afterward: `az ad app credential list --id "$APP_ID" --query "[].keyId" -o tsv`, then `az ad app credential delete --id "$APP_ID" --key-id <keyId>` for each one you no longer need.

## SP lifecycle management

```bash
# List an app's current secrets (id + display name + expiry, never the secret value itself)
az ad app credential list --id "$APP_ID" --query "[].{name:displayName,keyId:keyId,end:endDateTime}"

# Rotate: add a new secret before revoking the old one, so nothing goes down mid-rotation
NEW_SECRET=$(az ad app credential reset --id "$APP_ID" --append --display-name "<rotation-tag>" --years 1 --query password -o tsv)
# ... switch consumers over to $NEW_SECRET ...
az ad app credential delete --id "$APP_ID" --key-id <old-keyId>

# Remove from a security group (e.g. offboarding, scope reduction)
az ad group member remove --group <group-object-id> --member-id "$SP_OBJECT_ID"

# Full teardown
az ad sp delete --id "$APP_ID"     # removes the service principal object
az ad app delete --id "$APP_ID"    # removes the app registration itself
```

## Related references

- [Permissions](./permissions.md) - workspace role matrix, `fab acl` usage, the "Power BI Embedded specifics" section on SP-based embedding
- [fab vs az CLI](./fab-vs-az-cli.md) - Key Vault patterns for storing the secret, when to reach for `az` vs `fab`
- [Admin APIs](./admin.md) - reading and updating tenant settings at scale
- [Full Command Reference](./reference.md#common-error-scenarios) - `fab auth login` flag reference (certificate, federated token, managed identity)
