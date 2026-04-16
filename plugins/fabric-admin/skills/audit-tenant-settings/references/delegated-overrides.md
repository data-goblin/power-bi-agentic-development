# Delegated Overrides

Any tenant setting whose parent has `delegateToCapacity`, `delegateToDomain`, or `delegateToWorkspace` set to `true` can be replaced by a local override at that scope. The effective posture at a given workspace is: the tenant-wide setting, unless an override applies, in which case the override wins. Every audit has to enumerate overrides before drawing conclusions; skipping this step is the most common source of wrong governance reports.

## Enumerate every override, tenant-wide

```bash
fab api "admin/capacities/delegatedTenantSettingOverrides"
fab api "admin/domains/delegatedTenantSettingOverrides"
fab api "admin/workspaces/delegatedTenantSettingOverrides"
```

The capacity response ships both `overrides` and `value` arrays (legacy + current schema); domain and workspace ship only `value`. All three page via `continuationUri` / `continuationToken`; stream results for large tenants instead of materialising them all in memory.

## Scoped enumeration

Only `capacity` has a per-id endpoint. Per-domain and per-workspace variants return 404 and must be filtered client-side from the tenant-wide list.

```bash
# Per-capacity (native scoped endpoint)
fab api "admin/capacities/{capacityId}/delegatedTenantSettingOverrides"

# Per-domain (filter the tenant-wide list)
fab api "admin/domains/delegatedTenantSettingOverrides" \
  -q "text.value[?id=='{domainId}']"

# Per-workspace (filter the tenant-wide list)
fab api "admin/workspaces/delegatedTenantSettingOverrides" \
  -q "text.value[?id=='{workspaceId}']"
```

## Classification

Tag each override as one of the following before reporting. Never silently omit a compliant override; the user still needs to see effective posture at every scope.

| Tag | Meaning |
|---|---|
| `drift-vs-tenant` | Override differs from the tenant-wide posture. The intended case for overrides, but still worth surfacing so the admin sees where scope behavior diverges. |
| `drift-vs-recommended` | Override differs from the recommended posture in the curated baseline. Treat with the same severity as a tenant-wide drift for the same setting. |
| `high-risk` | The parent setting has `risk: high` in the metadata, regardless of direction. Surface these at the top of the overrides section. |
| `orphan` | Override exists for a setting whose parent does NOT delegate. It may not be taking effect but is worth cleaning up. |

## Rendering in audit output

Always include an "Overrides" section alongside the tenant-settings drift table. When the user asks about a specific workspace, capacity, or domain, render that scope's overrides above the tenant defaults so the effective posture is visible. For each override, show:

1. Parent setting portal title and API name
2. Scope (capacity / domain / workspace) and the ID or name
3. Override `enabled` vs parent tenant `enabled`
4. Override `enabledSecurityGroups` / `excludedSecurityGroups` / `properties` vs parent
5. Classification tag(s)
6. Recommended posture for the parent setting, pulled from the metadata

## Changing overrides

The Fabric admin REST API only exposes `Update` and `Delete` for **capacity** overrides. Domain and workspace overrides are read-only through the API and must be changed in the admin portal UI (Admin portal → Capacity / Domain / Workspace settings) by someone with the appropriate role.

When a user asks to change a domain or workspace override, explain that there is no API path, print the portal navigation, and stop. For capacity overrides the API path is available but still must not run without explicit confirmation.

```bash
# Update a capacity override (same body shape as the tenant-wide update endpoint)
cat > /tmp/override.json <<'EOF'
{
  "enabled": true,
  "properties": [
    {"name": "ArtifactRetentionPeriod", "value": "14", "type": "Integer"}
  ]
}
EOF
fab api -X post \
  "admin/capacities/{capacityId}/delegatedTenantSettingOverrides/{settingName}/update" \
  -i /tmp/override.json

# Remove a capacity override (reverts the scope to the parent tenant setting)
fab api -X delete \
  "admin/capacities/{capacityId}/delegatedTenantSettingOverrides/{settingName}"
```

Never run either command without explicit user confirmation. Print the command, explain what it will change, and wait.

## Common gotchas

- **Pagination.** All three endpoints can span thousands of overrides on big tenants. Always follow `continuationUri` until it's empty.
- **`value` vs `overrides`.** Capacity responses can include both arrays; `overrides` is the legacy shape. Read `value` first and fall back to `overrides` if the newer shape is empty.
- **Property type mismatches.** Update bodies have to match the property type declared on the parent setting. Pulling the parent metadata before patching the override avoids 400s on type coercion.
- **Orphan overrides survive metadata churn.** A setting may have had delegation turned off by Microsoft while historical overrides linger. Flag them, don't silently drop them.
- **Rate limit.** Admin write endpoints cap at 25 requests / minute. When scripting capacity updates, respect `Retry-After` and batch by setting, not by capacity, so a single backoff doesn't stall the whole pass.
