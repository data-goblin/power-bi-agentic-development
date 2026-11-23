# Service Principals for Fabric CLI Automation

End-to-end guide for creating an Entra service principal (SP), giving it Fabric access, and authenticating `fab` as it. Use this whenever a human wants an agent, pipeline, or scheduled job to run `fab` unattended instead of through their own interactive login.

An SP for Fabric automation needs **three separate grants**, not one. Missing any of them produces a working login that still fails on every real call:

1. An Entra app registration + service principal (identity)
2. A workspace role via `fab acl set` (items have no `fab acl`) (authorization on the content)
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

Never write the secret to a file. Pull it straight into 1Password, a Key Vault, or an env var at the point of use.

## 2. Grant workspace access

Same `fab acl set` used for human identities, just pointed at the SP's object ID:

```bash
fab acl set "ws.Workspace" -I "$SP_OBJECT_ID" -R Viewer -f
# or Contributor / Admin depending on what the SP needs to do
```

See [permissions.md](./permissions.md) for what `fab acl` covers and the role names.

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

This is what a deployed automation/agent should actually use day to day. Also supports certificate (`--certificate`), federated/OIDC token (`--federated-token`), and managed identity (`-I`) - see [commands.md](./commands.md) for the full list of auth modes.

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

All three token variables must be set (the docs also list `FAB_TENANT_ID`) or `fab` aborts immediately with `[UnexpectedError] FAB_TOKEN_AZURE` (or whichever is missing) before any network call. This is scoped to the process env, so it is the right one-off "does this SP work" check. From fab 1.8.0 the Azure CLI is also an auth source, so an `az login` as the SP can back `fab` by passing the --azure-cli flag to the login command ([auth command](https://microsoft.github.io/fabric-cli/commands/auth/)); the env tokens are ignored when it is in use ([environment variables](https://microsoft.github.io/fabric-cli/essentials/env_vars/)).

## Gotchas

- **`FAB_TOKEN` audience must be `https://analysis.windows.net/powerbi/api`**, not `https://api.fabric.microsoft.com`. The wrong audience produces `[UnexpectedError]` with a debug-log line reading "Audience doesn't match" rather than a normal auth failure - easy to mistake for a broken secret or missing permission when it's actually just the wrong resource in the token request.
- **Freshly created client secrets need roughly 60-75 seconds to propagate** through Entra before the token endpoint accepts them. A token request failing or returning empty right after `az ad app credential reset` is propagation delay, not a bad secret - wait and retry rather than immediately regenerating.
- **`fab auth login` under a HOME override fails on macOS** with a keychain error (`-25307`) because fab's credential storage expects the real login keychain to be reachable. Don't try to sandbox a test login by faking `$HOME` - use the env-token method above instead, which has no keychain dependency.
- **A valid workspace role is not sufficient on its own.** Skipping the tenant-setting group membership (step 3) is the single most common cause of `[Unauthorized] Access is unauthorized` on an SP that otherwise looks correctly configured - the workspace ACL says it should work and the token is valid, so it's easy to burn time double-checking the wrong thing.

## SP lifecycle management

- List secrets (no values): `az ad app credential list --id "$APP_ID" --query "[].{name:displayName,keyId:keyId,end:endDateTime}"`
- Rotate: add the new secret with `--append`, switch consumers, then `az ad app credential delete --id "$APP_ID" --key-id <old-keyId>`; this also covers cleaning up test secrets
- Offboard: `az ad group member remove --group <group-object-id> --member-id "$SP_OBJECT_ID"`, then `az ad sp delete --id "$APP_ID"` and `az ad app delete --id "$APP_ID"`

## Related references

- [Permissions](./permissions.md) - `fab acl` scope and roles, SP-based embedding
- [fab vs az](./fab-vs-az.md) - when to reach for `az` vs `fab`; Azure CLI as an auth source (`fab auth login --azure-cli`)
- [Admin APIs](./admin.md) - reading and updating tenant settings at scale
- [Commands](./commands.md) - auth modes (certificate, federated token, managed identity, environment variables)
