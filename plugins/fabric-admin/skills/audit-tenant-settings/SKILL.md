---
name: audit-tenant-settings
description: "Audit Fabric and Power BI tenant settings against a curated baseline: drift from the recommended posture, changes since the last snapshot, delegated overrides at capacity, domain and workspace scope, and the Entra security groups that scope a setting. Use for tenant-setting questions (PublishToWeb, service principal access, a setting's default or risk). Needs a Fabric admin account; read-only."
---

# Audit tenant settings

Read-only. The script does the merge, drift classification and change detection; this skill is how to run it and how to read it. Use the `fabric-cli` skill (this plugin requires the fabric-cli plugin) for `fab`.

## Rules

- Never guess a setting's behaviour, default, risk or SG membership. Use the baseline, the live API or Learn (https://learn.microsoft.com/en-us/fabric/admin/tenant-settings-index); if they disagree, trust Learn and say the baseline is stale
- 189 settings came back from the API on 2026-11-23 and the baseline covers all of them. 36 entries have `recommended: null` and `needs_review: true`: report those as "no curated posture" and read the Learn entry, never invent a recommendation. A live setting missing from the baseline, or the reverse, means Microsoft renamed or added one; say so
- `recommended` is a general default, not advice for this tenant. Present drift as a question about the user's scenario; make no compliance claims (HIPAA, SOC 2, GDPR)
- Never change a setting. Print the exact command and wait; admin writes are limited to 25 per minute:
  `fab api -X post "admin/tenantsettings/<SettingName>/update" -i body.json`
- Do not list SG members or workspace users unless asked; give counts and named red flags

## Run

1. `fab auth status`, then the admin probe `fab api admin/tenantsettings -q status_code` (200 = admin; 401 or 403 = stop and ask). Do not probe with `admin/capacities`: it returns 404 on the default audience
2. `uv run ${CLAUDE_SKILL_DIR}/scripts/audit-tenant-settings.py -o /tmp/tenant-audit.md` (dependencies are declared in the script). Variants: `--drift-only`, `--snapshot <file>` per tenant, `--no-snapshot` for a first run
3. Optional stakeholder PDF: `uv run ${CLAUDE_SKILL_DIR}/scripts/generate_audit_pdf.py -o /tmp/tenant-audit.pdf` (`--tenant-label`, `--no-overrides`)
4. Read the markdown once and report in this order: headline counts, changes since the last snapshot ("first run" if none), high-risk drift, SG scoping concerns, enabled preview features. Use portal titles; add `(settingName)` only where precision matters. Keep a full summary under 400 words

## Overrides and security groups

- A setting whose parent delegates (`delegateToCapacity`, `delegateToDomain`, `delegateToWorkspace`) can be replaced locally. Enumerate all three scopes before concluding anything, and never drop a compliant override: [references/delegated-overrides.md](./references/delegated-overrides.md)
- A setting scoped to an SG is only as strong as the group. Resolve each `graphId`, classify members and check admin roles: [references/security-groups.md](./references/security-groups.md). Needs `az login` with Graph read scopes; ask the user to log in
- Drill into one setting: `fab api admin/tenantsettings -q "text.tenantSettings[?settingName=='<Name>']"`, then the baseline entry (`grep -i -A8 '<Name>' ${CLAUDE_SKILL_DIR}/references/tenant-settings-metadata.yaml`). Answer with portal title and API name, description, preview status, current state, recommendation, risk, nuance, link

## Baseline

`references/tenant-settings-metadata.yaml` holds `human_name`, `description`, `preview`, `source_url`, `recommended` (`"on"`, `"off"`, `"on:sg"` or null), `default`, `risk`, `recommendation_nuance`, `needs_review`. To refresh it, diff the live names (`fab api admin/tenantsettings -q "text.tenantSettings[].settingName"`) against the yaml keys; add new settings with `recommended: null` until a human sets a posture.
