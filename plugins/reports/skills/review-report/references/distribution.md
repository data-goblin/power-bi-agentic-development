# Report Distribution and Access Paths

Reference for all the ways a user can gain access to a Power BI report, how to check each path programmatically, and best practices for distribution.

## Distribution Best Practices

### Preferred Distribution Channels

| Channel | Recommendation | Rationale |
|---|---|---|
| **Workspace App / Org App** | Preferred | Centrally managed, audience-scoped, version-controlled. Users get a curated experience without workspace access. Assume that Org Apps will eventually replace Workspace Apps, but note that Org apps are Fabric-only |
| **Direct workspace role (Viewer)** | Acceptable for small teams | Simple but tightly coupled to workspace. Users see all workspace content. |
| **Direct report sharing link** | Avoid for ongoing distribution | Hard to audit, no central management, easily forgotten. Acceptable for one-off sharing. |
| **Publish-to-web** | Avoid unless intentionally public | No authentication. Anyone with the URL can view the report. Security risk for internal data. |
| **Org-wide sharing link** | Avoid unless truly org-wide | Overly broad access. Use security groups instead. |

### Use Security Groups

Distribute access via Entra ID (Azure AD) security groups rather than individual users:
- **Central management:** IT or data team manages group membership in one place
- **Scalability:** Adding/removing users doesn't require touching Power BI
- **Auditability:** Group membership is logged in Entra ID
- **Consistency:** Same group can grant access across workspaces, apps, and reports

When reviewing a report's distribution, flag individual user assignments and recommend consolidation into security groups.

### View vs Edit Access

Surface the distinction between view-only and edit-capable users:

| Access Level | Workspace Roles | Direct Share Roles | Risk |
|---|---|---|---|
| **View only** | Viewer | Read, ReadReshare | Low -- consumers |
| **Can edit** | Contributor, Member, Admin | ReadWrite, Owner | Higher -- can modify report definition |

When presenting distribution findings, separate view-only users from edit-capable users. A report with 50 viewers and 15 editors warrants investigation -- most consumers should have view-only access.

## Access Paths

A user can access a Power BI report through six distinct channels. A comprehensive distribution audit checks all of them.

**Permission note:** Endpoints prefixed with `admin/` require the **Fabric Admin** role (tenant-level). Endpoints under `groups/{wsId}/` require at minimum a **workspace Admin** role. See `references/usage-metrics.md` for the full permission matrix.

### 1. Workspace Role

The most common access path. Users assigned to the workspace inherit access to all items within it.

| Role | Can View | Can Edit | Can Manage |
|---|---|---|---|
| Viewer | Yes | No | No |
| Contributor | Yes | Yes | No |
| Member | Yes | Yes | Partial |
| Admin | Yes | Yes | Yes |

**Check via API:**

```bash
fab api -A powerbi "groups/{workspaceId}/users"
```

**Response fields:** `emailAddress`, `displayName`, `groupUserAccessRight`, `principalType` (User, App, Group)

**Note:** Security groups appear as a single entry with `principalType: Group`. The API does not expand group membership. To enumerate individual users within a group, the Microsoft Graph API is required.

### 2. Direct Report Sharing

Reports can be shared directly with specific users, granting access without workspace membership.

**Check via API (admin):**

```bash
fab api -A powerbi "admin/reports/{reportId}/users"
```

**Response fields:** `emailAddress`, `reportUserAccessRight` (Owner, ReadWrite, Read, ReadReshare), `principalType`

**Non-admin alternative:**

```bash
fab api -A powerbi "groups/{workspaceId}/reports/{reportId}/users"
```

This returns users visible to the caller but may miss some if the caller lacks admin rights.

### 3. Workspace App (Power BI)

Reports can be packaged into an App and distributed to a broader audience. App users gain access to the report without workspace membership or direct sharing.

**Check if workspace has an app:**

```bash
fab api -A powerbi "admin/apps"
# Filter by workspaceId to find apps for the workspace
```

**Get app users:**

```bash
fab api -A powerbi "admin/apps/{appId}/users"
```

**Response fields:** `emailAddress`, `appUserAccessRight`, `principalType`

**Note:** A workspace app can have multiple audiences with different content visibility. The API returns all users but does not indicate which audience they belong to.

### 4. Org App

Organizational apps are distributed through the admin portal and installed by users or auto-installed via admin settings.

**Check via API:**

```bash
fab api -A powerbi "admin/apps"
# Look for apps with the workspace's reports
```

Org apps use the same API as regular apps. The distinction is in how the app is distributed (admin-installed vs user-published).

### 5. Publish-to-Web (Public Embed)

Publish-to-web creates a public, unauthenticated URL for the report. Anyone with the link can view the report. **This is a significant security risk for reports containing internal data.**

**Check via API (Fabric Admin):**

```bash
fab api -A powerbi "admin/widelySharedArtifacts/publishedToWeb"
```

**Response fields:** `artifactId`, `displayName`, `artifactType`, `shareType` (PublishToWeb), `sharer.emailAddress`

Filter the response by `artifactId` matching the report's GUID.

**Quick check for a specific report using fab CLI:**

```bash
# Check if a specific report has active publish-to-web links
fab api -A powerbi "admin/widelySharedArtifacts/publishedToWeb" \
  -q "ArtifactAccessEntities[?artifactId=='<report-id>']"
```

If the result is non-empty, the report is publicly accessible. Flag this as a critical finding in any review unless the report is intentionally public-facing.

**Revoking publish-to-web:** Cannot be done via API. Direct the workspace admin or Fabric admin to revoke via the Power BI admin portal under "Embed codes".

### 6. Org-Wide Sharing Links

Reports can be shared with a link that is accessible to everyone in the organization.

**Check via API (admin):**

```bash
fab api -A powerbi "admin/widelySharedArtifacts/linksSharedToWholeOrganization"
```

**Response fields:** Same as publish-to-web. Filter by `artifactId`.

## Resolving Security Groups and Distribution Lists

The Power BI APIs return security groups and distribution lists as a single entry with `principalType: Group`. The API does **not** expand group membership. This means a workspace shared with `Sales-Team@contoso.com` appears as one entry, but may represent 50 users.

### Expanding Group Membership

To enumerate individual users within a group, use the Microsoft Graph API:

```bash
# Get group members by group display name (requires Graph permissions)
# First, find the group's object ID
fab api -A azure "https://graph.microsoft.com/v1.0/groups?\$filter=displayName eq 'Sales-Team'"

# Then enumerate members
fab api -A azure "https://graph.microsoft.com/v1.0/groups/{groupId}/members"
```

**Required permissions:** `GroupMember.Read.All` or `Group.Read.All` (delegated or application).

If Graph API access is unavailable, note the group names in the audit and flag that the actual audience size is unknown. Ask the user or an admin to provide group membership counts.

### Nested Groups

Groups can contain other groups. The `/members` endpoint returns direct members only. To fully resolve nested groups:

```bash
# Transitive members (recursively expands nested groups)
fab api -A azure "https://graph.microsoft.com/v1.0/groups/{groupId}/transitiveMembers"
```

This returns all users regardless of nesting depth.

## Excluding Non-Consumer Users from Metrics

When evaluating whether a report is "being used," exclude users who are not the intended consumer audience. These users inflate viewer counts and distort adoption metrics.

### Users to Exclude

| Category | How to Identify | Why Exclude |
|---|---|---|
| Service principals | `principalType: App` | Automation, not human viewers |
| Report developers | Workspace Admin or Member role who also appear in commit history or activity logs with `UpdateReportContent` events | Views during development are not consumption |
| Support / IT admins | Fabric Admin role, or users whose views correlate with `UpdateReportContent`, `SetScheduledRefresh`, or other admin activities | Maintenance access, not consumption |
| Testers / QA | Users who viewed only during a narrow window around the report's creation date, then stopped | Testing views, not ongoing consumption |

### Practical Identification

Programmatic distinction between developers and consumers is imperfect. Use these heuristics:

1. **Workspace role as a proxy:** Users with `Viewer` role are almost always consumers. Users with `Admin`, `Member`, or `Contributor` roles *may* be developers -- cross-reference with their activity types.
2. **Activity type cross-reference:** Query the activity events API for the same user. If their activities include `UpdateReportContent`, `CreateReport`, or `DeleteReport` for this report, they are likely developers. If their only activity is `ViewReport`, they are consumers.
3. **Ask the user:** When the distinction matters, ask who the intended audience is. A report owner knows whether workspace admins are consumers or just maintainers.
4. **View pattern analysis:** Developers tend to have many views clustered around edit dates. Consumers tend to have views spread across regular intervals (daily, weekly).

When reporting audience reach, present two figures if developer/consumer distinction is ambiguous:

```
Audience reach (all users):     75% (6/8)
Audience reach (viewers only):  60% (3/5)  [excl. 3 workspace admins]
```

## Audience Reach Calculation

This is the most reliable metric for evaluating report success. It should be evaluated in the last 7 days, 28 days, and 60 days (if possible). To calculate how effectively a report reaches its intended audience:

```
Reach % = (unique consumer viewers / total consumer users with access) * 100
```

Where:
- **Unique consumer viewers** = distinct `UserId` values from `reportviews` endpoint, excluding service principals and identified developers/admins
- **Total consumer users with access** = sum of unique human consumer principals across all access paths (deduplicated), with security groups expanded where possible

### Interpreting Reach

| Reach | Interpretation |
|---|---|
| >80% | Strong adoption; report is well-targeted |
| 50-80% | Moderate; some users may not know about the report or find it useful |
| 20-50% | Low; investigate whether the audience is too broad or the report needs improvement |
| <20% | Very low; consider narrowing distribution or deprecating the report |

**Caveats:**
- Reach only captures views within the last 30 days (WABI metrics retention)
- Embedded views and API-driven consumption may not appear in view counts
- Security group membership is not expanded unless Graph API is available; actual human audience may be larger than what the Power BI APIs show
- Guest users (B2B) may have access but not appear in standard ACL queries
- Row-level security (RLS) may further restrict what users see even if they have report access

## Script Reference

Use `scripts/get_report_distribution.py` to check all access paths:

```bash
# Full distribution audit
python3 scripts/get_report_distribution.py -w <workspace-id> -r <report-id>

# JSON output for programmatic use
python3 scripts/get_report_distribution.py -w <workspace-id> -r <report-id> --output json
```

The script checks all six access paths and produces a deduplicated summary showing each user's access paths and roles.
