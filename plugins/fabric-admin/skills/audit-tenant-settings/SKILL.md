---
name: audit-tenant-settings
version: 0.25.3
description: Automatically invoke this skill whenever the user asks about Fabric tenant settings or Power BI tenant settings or auditing tenant settings. You can use this skill if the user mentions "Fabric administration".
---

# Audit Tenant Settings

Audit Fabric / Power BI tenant settings against a curated baseline, surface drift, enumerate delegated overrides at capacity / domain / workspace scope, investigate the Entra security groups those settings reference, and turn findings into a grounded discussion about what to do next. Always invoke the `fabric-cli` skill alongside this skill; it provides the `fab` CLI guidance, admin API references, and the `microsoft-learn` MCP server that this skill depends on.

## Prerequisites

This plugin is an add-on to the `fabric-cli` plugin. It requires:

- **fabric-cli plugin** installed and enabled; provides `fab` CLI guidance, the `microsoft-learn` MCP server, and admin API reference docs.
- **fab CLI** (`ms-fabric-cli`) authenticated with a Fabric / Power BI admin account.
- **az CLI** authenticated with Graph permissions (`Group.Read.All`, `User.Read.All`, `Directory.Read.All`, `RoleManagement.Read.Directory`) when investigating security groups.

## Settings

Per-project configuration via `.claude/fabric-admin.local.md`:

```markdown
---
enabled: true
tenant_label: "Contoso"
snapshot_path: "~/.cache/fabric-admin-audit/last-snapshot.json"
drift_threshold_high: 5
drift_threshold_medium: 15
notification_level: "info"
schedule: "weekly"
---

# Fabric Admin Configuration

Additional context or tenant-specific notes.
```

| Field | Type | Default | Purpose |
|---|---|---|---|
| `enabled` | bool | `true` | Toggle the plugin on/off |
| `tenant_label` | string | none | Label for PDF masthead and audit reports |
| `snapshot_path` | string | `~/.cache/fabric-admin-audit/last-snapshot.json` | Where to store/read the last-run snapshot JSON |
| `drift_threshold_high` | int | `5` | Alert when high-risk drift count exceeds this |
| `drift_threshold_medium` | int | `15` | Alert when total drift count exceeds this |
| `notification_level` | string | `info` | Verbosity: `quiet`, `info`, `verbose` |
| `schedule` | string | `weekly` | Preferred audit cadence: `daily`, `weekly`, `monthly`, `ad-hoc` |


## When to use this skill

Invoke for any tenant-, delegation-, or SG-scoped governance question that needs an interpreted answer rather than a raw API call. Typical asks:

- "Run a tenant governance audit"
- "Has anything drifted since last month?"
- "What does PublishToWeb do and should we have it on?"
- "Which settings are scoped to the PowerBI_ServicePrincipals group and who is in it?"
- "Show me every capacity / domain / workspace override"
- "Is this setting safe to enable for my scenario?"


## Critical rules

- **Never guess.** Tenant-setting behavior, SG membership, and override effects must come from the curated metadata, the live API, or Microsoft Learn. When sources are silent or contradict each other, say so plainly. 
- **Gather requirements.** Use your `AskUserQuestion` skill to regularly interview the user about their tenant, user behavior, and adoption. Use the `fabric-cli` skill and `fab` to understand an inventory of what's in the tenant, how it's structured, and the activity log / events to understand user adoption and activity. Flag key patterns, anomalies, and high-risk operations or scenarios (like publish-to-web, exports, and sharing with external users, full-org, or C-level employees)
- **Do not fabricate portal titles, descriptions, recommendations, risk levels, SG membership, or ACL shapes.** If the metadata or API lacks the fact, fetch it.
- **No absolute compliance claims** (HIPAA, SOC 2, GDPR, etc.). Limit conclusions to observed drift against the curated baseline and the raw API findings.
- **Recommendations are general, not prescriptive or universal.** The curated `recommended` field reflects subjective and community defaults, not the user's scenario. Always present the nuance and let the user decide.
- **Be pragmatic and critical; avoid alarmist language.** Consider the practicality of the user's scenario and engage with them in decision-making and planning so that they can understand the functional consequences of their current tenant setting configuration:
   - What does this mean for governance: what users can do, access, and create?
   - How does this affect key processes like creation, sharing, and distribution?
   - How does it affect capacity usage in Fabric and resource constraints?
   - How does it create friction that could inhibit effective analytics?
   - Would enabling or disabling result in blocking users or creating new dependencies?

## Authoritative sources (in order)

1. **Curated metadata**: `references/tenant-settings-metadata.yaml`. Holds `human_name`, `description`, `preview`, `source_url`, `recommended`, `risk`, and `recommendation_nuance` for every known setting. Check this first for any tenant-settings question.
2. **Live APIs** via `fab api` and `az`:
   - Tenant-wide state: `fab api "admin/tenantsettings"`
   - Delegated overrides: `fab api "admin/capacities/delegatedTenantSettingOverrides"`, `admin/domains/...`, `admin/workspaces/...`
   - Entra groups and role assignments: `az ad group`, `az rest --method get --uri https://graph.microsoft.com/v1.0/...`
3. **Microsoft Learn** via the `microsoft-learn` MCP server (`microsoft_docs_search`, `microsoft_docs_fetch`, `microsoft_code_sample_search`) or the `pbi-search` CLI as an alternative. Use when metadata is stale, the setting is brand new, or the user asks a feature question the baseline cannot answer.

## Workflow

Follow these steps in order. Skip a step only with a clear reason; never silently drop one.

### 1. Verify prerequisites

- `fab --version` is current; run `uv tool upgrade ms-fabric-cli` if stale.
- `fab auth status` confirms a live session; ask the user to run `fab auth login` if not.
- Admin access sanity check: `fab api "admin/capacities" 2>&1 | head -5`. A 401 / 403 means the account is not a Fabric / Power BI admin; stop and ask the user how to proceed (ask an admin to run it, or pivot to the non-admin scripts).
- If any SG investigation will be needed, `az account show` should resolve a session with at least `Group.Read.All`, `User.Read.All`, `Directory.Read.All`, and `RoleManagement.Read.Directory`. Ask for `az login` rather than auto-authenticating.

### 2. Run the audit script

```bash
uv run ${CLAUDE_PLUGIN_ROOT}/skills/audit-tenant-settings/scripts/audit-tenant-settings.py -o /tmp/tenant-audit.md
```

Common variants:

- `--drift-only` shortens the report to non-compliant settings only.
- `--snapshot /path/to/snap.json` keeps per-tenant isolation when auditing more than one tenant.
- `--no-snapshot` skips change detection (first runs, or when a clean slate is wanted).

The script merges live state with the curated metadata and computes drift, preview features, SG scoping, and changes since the last snapshot in one pass. Admin write endpoints are rate-limited to 25 requests / minute; honor `Retry-After` on 429.

For a shareable one-to-two-page briefing, run the PDF generator against the same snapshot:

```bash
uv run ${CLAUDE_PLUGIN_ROOT}/skills/audit-tenant-settings/scripts/generate_audit_pdf.py -o /tmp/tenant-audit.pdf
```

The PDF focuses on headline counts, changes since the last snapshot, the drift table, and a delegated-overrides summary. It reuses the same audit logic as the markdown script (via import) and reads the same snapshot path, so change detection stays in lockstep. Use `--no-overrides` to skip override enumeration when not running as admin, or `--tenant-label "Contoso"` to add a tenant name to the masthead. Pair the PDF with the markdown audit; the PDF is for stakeholders, the markdown is for the working walk-through.

### 3. Review the script output

Read the generated markdown once end-to-end, then surface findings in this order:

1. **Headline counts** from the Summary section (total, compliant, drift, preview, SG-scoped).
2. **Changes since last audit** (added, removed, toggled, sg_changed, property_changed). Say "first run" if no snapshot existed.
3. **High-risk drift**: settings tagged `risk: high` in the drift table.
4. **SG scoping concerns**: settings the baseline recommends scoping (`on:sg` / `off:sg`) that are currently org-wide, plus any heuristically-flagged individual UPNs.
5. **Preview features** currently enabled (admins often don't realize they consented to them).

Keep the summary concise (under 400 words). Use portal titles, not API names, in user-facing prose; annotate with `(settingName)` only where precision matters.

### 4. Enumerate delegated overrides

Tenant-wide state is half the picture. Any setting whose parent has `delegateToCapacity` / `delegateToDomain` / `delegateToWorkspace` set to `true` can be replaced by a local override at that scope. Skipping this step is the most common way governance reports go wrong.

Pull all three scopes and tag each override as `drift-vs-tenant`, `drift-vs-recommended`, `high-risk` (parent has `risk: high`), or `orphan` (parent does not delegate; override is vestigial). Never silently omit an override, even a compliant one. Render overrides above tenant defaults whenever the user asks about a specific workspace, capacity, or domain, so the effective posture is visible.

Full enumeration patterns, filtering, and change mechanics: [references/delegated-overrides.md](./references/delegated-overrides.md).

### 5. Investigate security group setup and strategy

Any setting scoped to a security group is only as strong as the group's membership, ownership, and governance. A recommended scoping that points to an empty or stale SG is effectively no scoping at all. Conversely, a setting restricted to a sprawling, dynamically-populated SG can be less restrictive than leaving it org-wide under a tenant with clean RLS.

Enumerate every `graphId` referenced by the live tenant settings, resolve each via `az ad group`, classify members by `@odata.type`, cross-check against Fabric / Power BI / Global admin role assignments, and feed each finding back onto the corresponding tenant-setting row. Red-flag categories (empty groups, guest members, stale owners, dynamic membership, nested SPs) and the exact Graph queries are in [references/security-groups.md](./references/security-groups.md).

When the SG strategy itself looks wrong (e.g. one SG reused for unrelated postures, individual users added directly to role-style groups, ownership sitting on departed employees), point it out plainly without alarmist framing. The goal is to help the user rethink the model, not scare them.

### 6. Drill down on areas of drift

For each setting where drift matters, ground the discussion in authoritative sources before opining:

1. Search the curated metadata by keyword:
   ```bash
   grep -i -A6 '<keyword>' ${CLAUDE_PLUGIN_ROOT}/skills/audit-tenant-settings/references/tenant-settings-metadata.yaml
   ```
2. Confirm the live state:
   ```bash
   fab api "admin/tenantsettings" -q "text.tenantSettings[?settingName=='<API name>']"
   ```
3. If the metadata is stale or lacks nuance for the scenario, fetch the canonical doc via the `microsoft-learn` MCP server:
   - `microsoft_docs_search` using the portal title or API name
   - `microsoft_docs_fetch` on the metadata's `source_url` or the top search hit
   - `microsoft_code_sample_search` when the user wants to see code implications
4. Answer in this shape: portal title + API name, one-sentence description, preview status, current state, recommended posture, risk level, recommendation nuance, docs link.

If metadata and docs disagree, trust the docs and surface the drift to the user so the baseline can be updated.

### 7. Present findings and open a grounded discussion

Present results objectively. Avoid alarmist language. A setting that drifts from the baseline is not automatically wrong; baselines are general, the user's scenario may differ. Equally, a setting that matches the baseline may still be wrong for the user's particular organization.

For every area of drift, pair two halves of the conversation:

- **Drift against recommended**: settings currently non-compliant with the curated baseline. Explain what changing them would do, what features break, what becomes possible.
- **Recommended but wrong for this user**: settings that match the baseline but might need to change based on the user's scenario (for example, a self-service org that needs `PublishToWeb` enabled selectively, or a regulated tenant that needs `ServicePrincipalsUseReadAdminAPIs` tighter than the general recommendation).

Ask short, targeted questions about the user's scenario when it matters for the recommendation: licensing model (Pro, PPU, Premium, Fabric), content lifecycle (self-service vs enterprise), regulatory posture, existing SG strategy, in-flight adoption goals. Do not interview the user about things that do not affect the recommendation.

### 8. Formulate next steps with the user

Co-develop a plan rather than handing one down. Candidates include:

- **Documentation**: capture current posture, SG membership, override inventory in a runbook before changing anything.
- **Security-group remediation**: create or consolidate SGs, allocate users/SPs, retire empty or stale groups, move ownership off departed employees.
- **Controlled tenant-setting changes**: pilot a subset of users via SG scoping first, then broaden. Always via the portal or the explicit `fab api -X post` command; never auto-applied from this skill.
- **Capacity / domain / workspace override audit**: walk the overrides list with the user and decide which are intentional and which should be removed.
- **Adoption-planning, implementation-planning, and security-and-compliance-planning** touchpoints from the Power BI implementation planning series. Point to the relevant articles rather than reproducing the content.
- **Scheduled snapshots and alerting**: when the user wants ongoing oversight rather than ad-hoc reviews, offer to set up a recurring run of the audit script (for example via `cron`, a scheduled GitHub Action, a Fabric notebook on a schedule, or an Azure DevOps pipeline) that refreshes the snapshot and ships the resulting diff somewhere visible. From there, change-detection output can feed an alerting surface; Fabric Activator is one option, but Teams or email via Power Automate, a pager via webhook, or a simple inbox rule all work. Use this to catch new settings Microsoft adds, posture drift, and SG membership changes without having to rerun the audit manually. Scope and wire-up are the user's call; the skill can help design the flow but should not stand anything up without explicit approval.

Close every plan with the disclaimer: "These recommendations are based on the curated baseline and the live API state at the time of this audit. The agent may not present fully accurate or scenario-appropriate information; the user is responsible for due diligence, piloting changes, and confirming with their own security, compliance, and Fabric administration teams before applying anything in production."

## Output standards

- Use portal titles (the `human_name` from metadata) in user-facing text; annotate with `(settingName)` only when precision matters or the API name is more recognizable.
- Summaries with counts render as ASCII tables or aligned bullet lists. No emojis, no decorative formatting.
- Quote descriptions and recommendations from metadata and docs verbatim; never paraphrase in a way that changes meaning.
- Full audit summaries under 400 words. Single-setting questions under 200 words. When a user asks for a binary "should we" on a setting whose `recommended` field is `review`, explicitly say the baseline has no hard position and present the nuance.
- Never expose full SG membership or full workspace user lists unless the user explicitly asks. Summarize with counts, role breakdowns, and named red flags.

## Edge cases

- **Unknown setting in live API**: Microsoft added it since the last metadata refresh. Fetch the Learn entry for context and offer to extend `tenant-settings-metadata.yaml`.
- **Metadata entry missing from live API**: setting was renamed or retired. Do not produce a recommendation.
- **Ambiguous setting phrasing**: if more than one setting matches the query, list candidates and ask which one.
- **No `fab auth` session**: ask the user to run `fab auth login` before proceeding. Do not auto-authenticate.
- **No `az login`** when an SG question comes up: ask for `az login`. Offer to fall back to the script's heuristic UPN flag for a first-pass smoke test.
- **Rate limit (429)**: back off per `Retry-After`. When resuming, resume from the failed setting rather than restarting.
- **Huge tenants**: admin workspace and items APIs are paged. Use `continuationUri` / `continuationToken` and stream; do not try to materialize everything into a single response.

## Resources

### Bundled

- `references/tenant-settings-metadata.yaml` ; curated baseline for every known Fabric / Power BI tenant setting (portal title, description, preview, recommendation, risk, nuance, docs link).
- `references/delegated-overrides.md` ; enumerate, classify, and (for capacity only) change delegated overrides.
- `references/security-groups.md` ; resolve graphIds, classify members, detect red flags, cross-check admin role assignments.
- `scripts/audit-tenant-settings.py` ; audit + change-detection script. Consumes the metadata yaml via its sibling `references/` path.
- `scripts/generate_audit_pdf.py` ; renders a clean one-to-two-page PDF briefing of the same audit. Reuses the audit logic by importing the sibling script, optionally enumerates delegated overrides, and emits a compact editorial-style summary with headline counts, changes since last audit, a drift table, and a delegated-overrides section. Run with `uv run scripts/generate_audit_pdf.py -o /tmp/tenant-audit.pdf` after (or instead of) the markdown audit; share the PDF with stakeholders, keep the markdown for the working walk-through.

### Related reading in the main fabric-cli skill

- `plugins/fabric-cli/skills/fabric-cli/references/admin.md` ; raw admin API mechanics for settings updates, paging, and activity events.
- `plugins/fabric-cli/skills/fabric-cli/references/permissions.md` ; workspace and item ACL workflows for the cross-domain half of a governance audit.
- `plugins/fabric-cli/skills/fabric-cli/SKILL.md` ; entry point and command reference for the `fab` CLI.

### External

- [Microsoft Learn tenant settings index](https://learn.microsoft.com/en-us/fabric/admin/tenant-settings-index) ; authoritative upstream for every setting the script can surface.
- [Power BI implementation planning: security and compliance planning](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-security-planning) ; pair with findings during step 8.
