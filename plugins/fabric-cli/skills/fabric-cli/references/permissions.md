# Permissions, Sharing, and Content Distribution

Reference for how content is shared in Power BI and Microsoft Fabric ; the places where roles and permissions are set, the ways content is distributed, licensing implications, and best practices.

Primary source: [Power BI implementation planning: Content distribution and sharing](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-content-distribution-sharing).

## Sharing vs distribution

Microsoft's guidance distinguishes two activities, even though the terms are used interchangeably in the UI:

- **Content sharing** ; giving specific users access to a specific item as part of day-to-day work (e.g. sharing a report link to three teammates).
- **Content distribution** ; making content available at scale to a wider audience (e.g. publishing an app to a department, or embedding in a customer-facing website).

Use sharing for ad-hoc, small-audience collaboration. Use distribution (via apps, workspace Viewer role, or embed) for durable, large-audience delivery.

---

## Where you set roles and permissions

There are five places you can grant access to content. They stack ; a user can have multiple simultaneously.

| Scope | What it grants | Granularity |
|---|---|---|
| **Workspace roles** | Admin / Member / Contributor / Viewer on every item in the workspace | Coarse, workspace-wide |
| **App audiences** | Read (plus optional Build) on items included in an app, per audience | Multiple audiences per app, no Write |
| **Item direct access** | Read / Reshare / Build / Write on a single item via link or permission pane | Per-item |
| **Report links** | Read via link that targets specific users, groups, or the entire organization | Per-report link |
| **Embed / publish** | Read via embedded viewer, custom app, or Publish to web | Scoped to the embed session |

Apps that show reports from the workspace also require Read access to any **cross-workspace semantic models** the reports connect to.

---

## Workspace roles

Workspaces are the primary collaboration container. Assign users (preferably via security groups) to one of four nested roles. Each role includes everything the role below it can do.

| Capability | Admin | Member | Contributor | Viewer |
|---|---|---|---|---|
| Update, delete, or configure the workspace | Yes | | | |
| Add or remove users in any role | Yes | | | |
| Allow contributors to update the app | Yes | | | |
| Add users at a lower role | Yes | Yes | | |
| Publish, update, or unpublish the Power BI app | Yes | Yes | | |
| Share items and semantic models | Yes | Yes | | |
| Create, edit, delete content in the workspace | Yes | Yes | Yes | |
| Write / modify items | Yes | Yes | Yes | |
| Schedule refresh (via gateway) | Yes | Yes | Yes | |
| Copy reports, connect to semantic models (Build via workspace role) | Yes | Yes | Yes | |
| Analyze in Excel, download PBIX | Yes | Yes | Yes | |
| Read / view content | Yes | Yes | Yes | Yes |
| Receive subscriptions | Yes | Yes | Yes | Yes |

Notes:

- **Viewers get Read only.** Use the Viewer role to enforce row-level security for consumers who browse a workspace directly.
- **Viewers can Analyze in Excel or export underlying data only if they also have Build permission** on the relevant semantic model.
- **Members cannot change existing users' roles.** Only an admin can. A member can add new users at equal or lower roles, but cannot remove or demote anyone.
- **Disabling a user in Microsoft Entra ID does not remove their workspace access records** ; the records remain until the account is hard-deleted. The user cannot access anything while disabled, but access is restored if the account is re-enabled.

Reference: [Roles in workspaces](https://learn.microsoft.com/power-bi/collaborate-share/service-roles-new-workspaces#workspace-roles).

### Managing workspace access via `fab acl`

```bash
# List workspace roles
fab acl ls "ws.Workspace"

# Grant Member role to a user
fab acl set "ws.Workspace" -I user@contoso.com -R Member

# Grant Viewer role to a security group (pass the Entra object ID)
fab acl set "ws.Workspace" -I <group-object-id> -R Viewer

# Remove a user
fab acl rm "ws.Workspace" -I user@contoso.com
```

Valid roles for `-R`: `Admin`, `Member`, `Contributor`, `Viewer`.

---

## Item permissions

When you share a single item (instead of the whole workspace), you grant one of four permissions. These are sometimes called "direct access" and are set on the item itself.

| Permission | Lets the user ... | Respects RLS? |
|---|---|---|
| **Read** | View the item (and for reports, interact with the underlying model through the report) | Yes |
| **Reshare** | Share the item to other users; combined with Build, can also grant Build to others | Yes |
| **Build** | Connect to a semantic model, lakehouse, or warehouse to create new content (Analyze in Excel, new reports, composite models) | Yes |
| **Write** | Modify and save the item | No ; Write bypasses RLS because Write holders can edit the security rules |

Key behavioral points:

- **Build vs Write are not the same.** Workspace Admin/Member/Contributor all grant Write (and therefore bypass RLS). If a consumer needs to author their own reports against a secured semantic model, grant Build, not a workspace role.
- **Build at the app audience level** cascades to underlying semantic models automatically. Use this when consumers of an app also need Analyze in Excel.
- Some items (like **dataflows**) do not support direct-access sharing. Share them via workspace roles only.
- Some items (**lakehouses**) use more granular `ReadData` / `ReadAll` permissions managed via item sharing and OneLake data access roles.
- Granting Build via a report or app audience automatically applies it to the underlying semantic models of that report or app.

### Listing and setting item ACLs

```bash
fab acl ls "ws.Workspace/Model.SemanticModel"
fab acl set "ws.Workspace/Model.SemanticModel" -I user@contoso.com -R Read
fab acl set "ws.Workspace/Model.SemanticModel" -I user@contoso.com -R Build
```

---

## Apps

Power BI has two app systems. Both distribute packaged content to audiences.

- **Workspace apps** (legacy Power BI apps) ; one per workspace, snapshot-based, fixed audiences, managed from workspace settings.
- **Org apps** (Fabric-native, in preview) ; multiple per workspace, live references, first-class Fabric items, Git-integrated, automatic semantic model access.

Full comparison and API details are in [org-apps.md](./org-apps.md). Key permission differences:

- **Workspace apps** grant Read to audience members. Removing a user from the audience does **not** revoke their access to cross-workspace semantic models that they were granted for the app ; that has to be revoked manually.
- **Org apps** grant Read to audience members and automatically grant Read to any associated semantic models, even in other workspaces. Removing a user revokes all access.
- **Contributors can update a workspace app** only if the workspace Admin has toggled "Allow contributors to update the app". They still cannot publish a new app or change permissions.
- **Reshare inside an app** requires the app creator to toggle "Allow users to share the semantic models in this app"; otherwise only Admin and Member can reshare.

Recommendation: **distribute via apps**, not workspace Viewer role. Apps provide a curated surface, hide non-reporting items, and eliminate the risk of accidentally promoting someone to Write access.

---

## Direct access and links

When you share a single report or dashboard with someone, Power BI offers several link types:

- **Specific people** ; works only for the named users or groups.
- **People in your organization** ; anyone in the tenant who gets the link.
- **Existing access** ; generates a link usable only by people who already have access.

Consumers who have Reshare can create **shared views** ; named snapshots of filter and slicer state. Shared views are useful for discussion and issue reporting because they preserve the exact state of the report. Content owners manage existing shared views from **Manage permissions**.

Users who click a link they cannot access see a **Request access** prompt. Plan a process to triage these requests, or they accumulate in the owner's inbox.

---

## Embedding options

Power BI content can be embedded in many places. The mechanism and license implication differ:

| Method | Scope | Capacity required | Consumer license |
|---|---|---|---|
| Embed in Microsoft Teams (tab or chat) | Internal | None beyond workspace hosting | Same as standard Power BI access |
| Embed in PowerPoint (add-in) | Internal | None | Same as standard Power BI access |
| Embed in SharePoint Online (web part) | Internal | None | Same as standard Power BI access |
| Embed in Power Apps canvas app (PBI visual) | Internal | None beyond PBI hosting | Power BI access + Power Apps license |
| Secure embed in internal website (iframe) | Internal | None | Same as standard Power BI access |
| **Embed for your organization** (JS SDK, user-owns-data) | Internal | F, P, EM, or A SKU | Each viewer needs Pro/PPU below F64 |
| **Embed for your customers** (JS SDK, app-owns-data) | External | F, P, EM, or A SKU | No user license required |
| **Publish to web** | Public internet | None | None (no authentication) |

Embed-for-your-organization vs embed-for-your-customers:

- **Embed for your organization** ; internal users, each viewer authenticates to Microsoft Entra ID and needs a Power BI license (unless hosted on F64+ capacity, where Free licenses can consume content).
- **Embed for your customers** ; external users, the app authenticates on their behalf using a service principal or master user. End users do not need any Power BI license. This is the ISV scenario, and it carries no user licensing cost but needs a capacity (A, EM, F, or P).

Subscriptions (regular, dynamic, per-recipient) and the **Export to file** REST API are distribution channels too ; avoid using exported files as a primary distribution strategy because they create governance risks, lose interactivity, and indicate low adoption maturity.

---

## Publish to web

Publish to web makes a report available via an iframe link to **anyone on the internet with no authentication**. Use only for content that is genuinely public (data journalism, marketing pages, public dashboards).

- Disabled at tenant level by default.
- Should be restricted by a Fabric admin to a specific security group of trusted users.
- Not logged to the audit log at the view level.
- Subject to many feature limitations ; test before committing.

Never use Publish to web for sensitive, confidential, or internal content. Incidents of accidental exposure are a recurring Microsoft support case.

---

## External users

Three approaches to distribute to users outside your tenant:

1. **Duplicate identity in your tenant** ; the external user gets a net-new account in your Entra tenant and a per-user license. Simple to understand but expensive and generates identity sprawl.
2. **Microsoft Entra B2B guest user** ; recommended default. The Azure admin adds the external user as a guest. They can either receive a per-user license from your tenant or bring their own (BYOL) from their home tenant. Subject to B2B limitations: guests cannot use Analyze in Excel, cannot connect from Power BI Desktop to service models, cannot publish from Desktop, cannot install a gateway, cannot set sensitivity labels.
3. **Embed for your customers** ; the ISV pattern. External users never touch Entra B2B; the custom application authenticates on their behalf with a service principal.

B2B guests can also consume semantic models shared cross-tenant through **in-place semantic model sharing**, which lets them create composite models and reports in their own tenant against your model.

Reference: [Distribute Power BI content to external guest users using Microsoft Entra B2B](https://learn.microsoft.com/en-us/fabric/enterprise/powerbi/service-admin-entra-b2b).

---

## Deployment pipeline permissions

Pipeline access is set **separately from workspace roles**, but most actions require both. Pipeline access alone does not let anyone see workspace content.

| Action | Required permissions |
|---|---|
| View the list of pipelines | None (Free license) |
| Create a pipeline | Pro, PPU, or Premium Per User license |
| Delete a pipeline | Pipeline admin |
| Add or remove a pipeline user | Pipeline admin |
| Assign a workspace to a stage | Pipeline admin AND workspace Admin on that workspace |
| Unassign a workspace | Pipeline admin OR workspace Admin (via API) |
| Deploy to an empty stage | Pipeline admin AND source-workspace Contributor |
| Deploy items to next stage | Pipeline admin AND Contributor on both source and target workspaces. Dataflows require the deployer to own the item. Semantic models also require ownership if the block-republish tenant setting is on |
| View or set a deployment rule | Pipeline admin AND Contributor/Member/Admin on target workspace AND owner of the item |
| Manage pipeline settings | Pipeline admin |
| View a pipeline stage | Pipeline admin OR workspace Viewer/Contributor/Member/Admin |
| View the list of items in a stage | Pipeline admin |
| Compare two stages | Pipeline admin OR Contributor/Member/Admin in both stages |
| View deployment history | Pipeline admin |

Key considerations:

- **Pipeline roles are set once for the whole pipeline.** Workspace roles are set per stage ; development, test, and production typically have different role membership.
- **Only semantic model owners can deploy semantic models** when the "block republish and disable package refresh" tenant setting is enabled.
- **Service principals can deploy via the REST API** but cannot configure OAuth credentials on deployed items, and cannot deploy dataflows. They become the owner of paginated reports and semantic models they deploy, which can break refresh.
- **GCC environments require at least Member role** on both source and target workspaces; Contributor is not sufficient for GCC deployments.

Reference: [The deployment pipelines process, Permissions](https://learn.microsoft.com/fabric/cicd/deployment-pipelines/understand-the-deployment-process#permissions). See [deployment-pipelines.md](./deployment-pipelines.md) for CLI and API usage.

---

## Supporting roles that affect access

These do not grant item access directly but gate specific capabilities.

- **[Data gateway roles](https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-manage)** ; gateway Admin, Gateway Admin, and per-data-source User / User-with-sharing roles. Required when a DirectQuery semantic model uses DirectQuery with single sign-on ; users must be added to the connection User role to view the report.
- **Row-level security (RLS) roles** ; defined in the semantic model, mapped to users or groups in the service. Enforced when users have Read or Build. **Bypassed when users have Write** (workspace Admin/Member/Contributor).
- **Object-level security (OLS)** ; hides specific tables or columns. Same enforcement model as RLS.
- **OneLake data access roles** ; RBAC on lakehouse folders. Users first need ReadAll or Write on the lakehouse, then the data access role scopes what files and tables they can see.

Security groups are the recommended membership unit for all of these ; avoid assigning individuals directly.

---

## Licensing and capacity

Licensing determines **whether** a user can consume content. Permissions determine **what** they can do with it. Both are required.

### Per-user licenses

| License | Author content? | Share content? | Consume content in non-capacity workspace? | Consume content in Fabric F64+ or Premium capacity? |
|---|---|---|---|---|
| Microsoft Fabric Free | Fabric items in Fabric capacity only | No (Power BI) | No | Yes |
| Power BI Pro | Yes | Yes | Yes | Yes |
| Premium Per User (PPU) | Yes, plus Premium features | Yes (PPU workspace type requires PPU for all parties) | Yes | Yes |

Notes:

- **Creators always need Pro or PPU to author and share Power BI content,** even when the workspace is on Fabric capacity.
- **Consumers in an F64+ (or P-SKU, or Premium) capacity only need a Free license.** This is the "free consumption" benefit of large Fabric capacities and the single most common reason organizations buy capacity.
- **Below F64 (F2 to F32), consumers still need a Pro or PPU license** unless the content is embedded via "Embed for your customers".
- **PPU workspaces require PPU for everyone**, including consumers. Fabric capacity does not.
- **Licenses affect visibility, not permissions.** Giving a user a Pro license does not grant them Build or Write; those must still be granted explicitly.

### Capacity SKUs

| SKU family | Source | Fabric items? | Free-consumer viewing? | Embedding target |
|---|---|---|---|---|
| **F SKU (Fabric)** | Azure, pay-as-you-go or reserved; pausable | Yes | F64 and above only | Embed for org, embed for customers |
| **P SKU (Premium per capacity)** | Microsoft 365, yearly or monthly commit; being retired | Yes | All P SKUs | Embed for org, embed for customers |
| **EM SKU (Premium Embedded)** | Microsoft 365, yearly commit | No | No | Embed in MS apps only (no Power BI service access) |
| **A SKU (Power BI Embedded)** | Azure, hourly, pausable | No | No | Embed for customers only (ISV scenario) |

Notes:

- Microsoft is consolidating purchase options and retiring P SKUs. **New deployments should use F SKUs.**
- F64 and P1 are the thresholds at which Free-license consumers can view content. Below that, every consumer needs Pro or PPU.
- A SKUs are the traditional Power BI Embedded offering for ISVs ; hourly billing, no Fabric items, intended only for embed-for-customers scenarios.
- EM SKUs are a narrow special case for embedding in Microsoft 365 apps (SharePoint, Teams) without Power BI service access.
- Semantic model memory is bounded by the SKU, not by cumulative capacity usage ; e.g. a single model on F64 is capped at 25 GB.

Reference: [Capacity and SKUs in Power BI embedded analytics](https://learn.microsoft.com/power-bi/developer/embedded/embedded-capacity) and [Subscriptions, licenses, and trials](https://learn.microsoft.com/power-bi/guidance/powerbi-implementation-planning-subscriptions-licenses-trials).

---

## Power BI Embedded specifics

When an application embeds Power BI content for end users, it authenticates one of three ways:

- **Service principal** ; recommended for production. Entra ID app registration authenticates with a secret or certificate. Needs the tenant setting "Allow service principals to use Power BI APIs" enabled and the SP in the allow group. Cannot set OAuth credentials on datasets; cannot be used for paginated reports in master-user embed.
- **Master user account** ; a regular Entra user with Pro or PPU, assigned workspace Admin or Member. Simpler to set up; less secure and harder to scale; cannot embed paginated reports.
- **End-user delegated (embed for your organization only)** ; the signed-in user authenticates to Entra and consumes with their own license.

Embed-for-customers constraints:

- End users do **not** need Power BI licenses.
- Service principal (recommended) or master user authenticates on their behalf.
- Content must live in a workspace on F, P, EM, or A capacity.
- For development only, you can use free embed trial tokens with a Pro license; trial banners appear until a capacity is attached.

---

## Best practices

Follow these regardless of distribution method:

- **Use security groups, not individual accounts, for every role and permission assignment.** Mail-enabled groups, distribution lists, and Microsoft 365 groups are all valid. This scales, supports onboarding/offboarding automation, and prevents orphaned individual ACL entries.
- **Apply the principle of least privilege.** Do not assign Admin or Member to someone who only needs to author content in a workspace. Start at Contributor and escalate on request.
- **Distribute via apps, not via workspace Viewer role.** Apps hide clutter, prevent accidental elevation to Write, and provide audience segmentation.
- **Keep sensitive data out of Publish to web.** Disable it at tenant level except for a trusted security group, and audit usage regularly.
- **Separate development, test, and production workspaces.** Assign different role membership per stage; typically production viewers are consumers and production Admin/Member is IT/COE only.
- **Do not mix Write and RLS.** Users who need RLS enforcement must have Read or Build, not Write. Granting a workspace role of Contributor or above silently bypasses RLS.
- **Audit regularly.** Workspace role drift, stale access requests, and overshared items are the primary governance issues. Use the tenant admin APIs (see [admin.md](./admin.md)) and activity events to inventory shares.
- **Plan external access before building it.** Entra B2B has real limitations (Analyze in Excel, Desktop publish, sensitivity labels). Run a small pilot with real external users before committing.
- **Monitor cross-workspace dependencies.** Reports in an app that connect to semantic models in other workspaces require explicit Read on those models ; they do not inherit via the app.
- **Plan the permission model before building.** Decide who authors, who deploys, who consumes. Map each to a role on dev/test/prod workspaces and on the pipeline. Document the mapping before you create the workspaces.

---

## Common pitfalls

- **Build granted via workspace role.** A workspace Contributor has Write, not Build. Write bypasses RLS. If a user should have RLS-enforced analysis access, grant Build on the semantic model and **not** a workspace role.
- **Workspace app reshare revocation gap.** Removing a user from a workspace app audience does not revoke Read on cross-workspace semantic models granted via the app. Clean up manually, or migrate to an org app.
- **Pipeline deployer not in both stages.** Deploying items between stages requires the deployer to be at least Contributor on both source and target workspaces. A pipeline admin alone is not enough.
- **Publish to web left enabled tenant-wide.** Default off; verify it stays off except for an explicit allow group.
- **F SKU below F64.** Free consumers cannot view content. Every viewer still needs Pro or PPU until the capacity is F64 or higher.
- **PPU workspace with a Pro consumer.** PPU workspaces require PPU for everyone; a Pro user will get "only PPU licensed users can access this content".
- **Disabled Entra user still has access records.** Access is blocked while disabled, but the ACL entries remain until hard-delete. Do not rely on disable as a revocation mechanism ; remove from groups and ACLs explicitly if permanent.
- **Service principal as deployer.** SPs become the owner of deployed paginated reports and semantic models, which breaks refresh because SPs cannot set OAuth credentials. Use a master user or manually reassign ownership after deploy.

---

## Related references

- [Workspaces](./workspaces.md) ; create, configure, permissions via fab CLI
- [Org Apps](./org-apps.md) ; org apps vs workspace apps in depth
- [Deployment Pipelines](./deployment-pipelines.md) ; pipeline CLI and API usage
- [Admin APIs](./admin.md) ; cross-tenant audit of shares, roles, and activity
- [Gateways](./gateways.md) ; gateway and data source connection roles
- Tenant Settings Audit skill (in the `fabric-admin` plugin) ; curated baseline yaml and audit workflow for export / sharing / access tenant settings
