# Security Groups Behind Tenant Settings

Tenant-setting scoping, certification and endorsement, guest access, service-principal admin permissions, and most distribution postures are only as strong as the Entra security groups they point at. A stale, empty, or over-permissioned SG silently weakens every setting that references it.

This reference covers the four moves needed to audit SGs from a Fabric governance perspective: enumerate the graphIds in use, resolve each group, flag red-flag patterns, and cross-check admin role assignments. Feed everything back into the tenant-settings report so the admin sees the full picture per setting.

## 1. Enumerate every SG referenced across tenant settings

```bash
fab api "admin/tenantsettings" --output_format json 2>/dev/null \
  | jq -r '.result.data[0].text.tenantSettings[]
           | (.enabledSecurityGroups // []) + (.excludedSecurityGroups // [])
           | .[] | "\(.graphId)\t\(.name)"' \
  | sort -u
```

For each `graphId`, track which settings reference it. The same SG often shows up across unrelated settings; that's an important signal by itself (see red flags below).

## 2. Resolve each group via Azure CLI

```bash
az ad group show   --group <graphId>                  # existence + metadata
az ad group member list --group <graphId> --all       # direct members (users, SPs, nested groups)
az ad group owner list  --group <graphId>             # owners (can add/remove members)
```

Classify members by `@odata.type`:

- `#microsoft.graph.user` ; human account. Read `userPrincipalName`. `#EXT#` in the UPN marks external guests.
- `#microsoft.graph.servicePrincipal` ; app identity. Pair with `az ad sp show` for app metadata.
- `#microsoft.graph.group` ; nested group. Recurse so final membership is flattened.

For dynamic groups, the membership rule itself is part of the audit:

```bash
az ad group show --group <graphId> --query membershipRule
```

## 3. Red flags to report

Surface findings per SG with a short rationale and the list of tenant settings affected. Avoid alarmist framing; state what the situation is and what posture depends on it.

- **Empty groups** referenced by a critical setting (e.g. `AllowServicePrincipalsUseReadAdminAPIs`). Scoping is meaningless when no one is in.
- **Individual users** added directly where the intent was role-based. Churn and offboarding risk; SG becomes a personal allowlist.
- **Guest users** (`#EXT#` in UPN) inside SGs scoping write-capable admin settings. External accounts with tenant-admin reach are almost always a misconfiguration.
- **Nested groups with owners outside IT** who can silently grant themselves or others Fabric access.
- **Dynamic membership groups** with liberal rules (broad `userType`, `department`, or tag-based filters) used to scope narrow admin capabilities.
- **Service principals with elevated Graph permissions** nested into a tenant-setting SG without an obvious owning automation.
- **Stale groups** whose membership hasn't changed in months. Compare `createdDateTime` / `renewedDateTime` on `az ad group show`.
- **Groups owned by departed employees** or with no owner at all. Nobody can responsibly curate them.
- **One SG scoping unrelated postures.** A single "PowerBI_Admins" group used for `PublishToWeb`, `AllowServicePrincipalsUseReadAdminAPIs`, and `EnableExternalDataSharing` is probably not the intended model; each setting usually deserves a dedicated SG so changes don't cascade unintentionally.

## 4. Cross-check Entra role assignments

Members of Fabric, Power BI, or Global admin roles bypass most tenant settings. Audit active assignments so SG-scoped postures aren't undermined by role-level access:

```bash
# Fabric Administrator role (well-known role template ID)
az rest --method get \
  --uri "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?\$filter=roleDefinitionId eq 'a9ea8996-122f-4c74-9520-8edcd192826c'&\$expand=principal"

# Global Administrator role (well-known role template ID)
az rest --method get \
  --uri "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?\$filter=roleDefinitionId eq '62e90394-69f5-4237-9190-012177145e10'&\$expand=principal"
```

If the tenant uses Privileged Identity Management (PIM), also check `roleEligibilitySchedules`; eligibility and active assignment are separate, and PIM-eligible principals still count for bypass calculations once they activate.

## 5. Feed back into the tenant-settings report

After resolving groups, re-read the `audit-tenant-settings.py` output. For each SG-scoped entry, attach:

- Member count (total, users, SPs, guests)
- Owner count
- Red-flag list (empty / stale / dynamic / guest / nested-SP / unowned)
- The tenant settings that also reference this SG (so the admin sees the blast radius of any membership change)

## Prerequisites for SG work

- `az login` with at least `Group.Read.All`, `User.Read.All`, `Directory.Read.All`, and `RoleManagement.Read.Directory` scopes. Verify with `az account show`.
- For PIM queries, also `PrivilegedAccess.Read.AzureAD`.
- Ask the user to run `az login` themselves; don't auto-authenticate.

## Output standards for SG findings

- Summarize membership with counts, never full member lists unless the user explicitly asks.
- When presenting red flags, name the group, state the SG's current membership profile, and list which tenant settings reference it.
- Do not produce compliance claims ("this SG violates SOC 2"); state the facts and let the user draw the compliance conclusion with their own team.
- When a red flag depends on an assumption (e.g. "stale groups haven't changed in months"), say so explicitly; the metric is heuristic, not absolute.
