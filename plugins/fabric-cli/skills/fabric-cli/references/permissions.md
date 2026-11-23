# Permissions and sharing

What `fab` can set, what needs REST, and the access rules that surprise people. Role and license tables are on Learn; they are not repeated here.

## Learn

```yaml
workspace roles: https://learn.microsoft.com/en-us/fabric/fundamentals/roles-workspaces
content sharing and distribution: https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-content-distribution-sharing
semantic model permissions: https://learn.microsoft.com/en-us/fabric/security/permission-model
OneLake data access roles: https://learn.microsoft.com/en-us/fabric/onelake/security/get-started-data-access-roles
Entra B2B guests: https://learn.microsoft.com/en-us/fabric/enterprise/powerbi/service-admin-entra-b2b
pipeline permissions: https://learn.microsoft.com/en-us/fabric/cicd/deployment-pipelines/understand-the-deployment-process
capacity and licenses: https://learn.microsoft.com/en-us/power-bi/developer/embedded/embedded-capacity
```

## What `fab acl` covers

`fab acl` works on three scopes only: workspace, connection and gateway. There is no item-level ACL: `fab acl ls` on a semantic model, report or lakehouse returns `[UnsupportedCommand]`.

```yaml
workspace roles: Admin | Member | Contributor | Viewer
connection roles: Owner | User | UserWithReshare
gateway roles: Admin | ConnectionCreator | ConnectionCreatorWithResharing
```

```bash
fab acl ls "ws.Workspace" -l
fab acl get "ws.Workspace" -q "[?role=='Admin']"
fab acl set "ws.Workspace" -I <entra-object-id> -R Viewer -f
fab acl set .connections/conn1.Connection -I <entra-object-id> -R User
fab acl set .gateways/gw1.Gateway -I <entra-object-id> -R ConnectionCreator
fab acl rm "ws.Workspace" -I user@contoso.com -f
```

- `acl set -I` takes an Entra objectId (user, group or service principal); a UPN works only with `acl rm`
- There is no `-R Read` or `-R Build`; those are item permissions
- For a service principal, `-I` is its object id, not its client id, although `acl ls` shows the client id in the `identity` column (see [service-principals.md](./service-principals.md))
- Use security groups for every assignment; pass the group's object id

## Item permissions need REST

Reading, sharing or restricting a single item (Read, Reshare, Build, Write on a report, model or lakehouse) is not in `fab acl`; use the REST APIs through `fab api`.

```bash
fab api -A powerbi "groups/$WS/datasets/$MODEL/users"
fab api -A powerbi -X post "groups/$WS/datasets/$MODEL/users" -i '{"identifier":"<object-id>","principalType":"User","datasetUserAccessRight":"Read"}'
```

- The dataset users calls are [Post Dataset User In Group](https://learn.microsoft.com/en-us/rest/api/power-bi/datasets/post-dataset-user-in-group) and Put Dataset User In Group (update an existing grant). Body: `identifier` (UPN for `User`, object id otherwise), `principalType` (`None`, `User`, `Group`, `App`), `datasetUserAccessRight` (`Read`, `ReadReshare`, `ReadExplore`, `ReadReshareExplore`; there is no `ReadWrite`)
- Limits on Post Dataset User: service principals (`App`) cannot be added, the caller needs ReadReshare on the model, and Write cannot be granted with it
- The [Fabric Items REST reference](https://learn.microsoft.com/en-us/rest/api/fabric/core/items) has no item-permissions operation; the admin group only reads ([List Item Access Details](https://learn.microsoft.com/en-us/rest/api/fabric/admin/items))
- Tenant-wide read of who can reach an item: `fab api -A powerbi admin/users/<userGraphId>/artifactAccess` (see [admin.md](./admin.md))
- Lakehouse and warehouse data access is more granular (ReadData, ReadAll, OneLake data access roles); manage it in the portal or the OneLake security APIs

## Rules that surprise people

- Write bypasses row-level security, and workspace Admin, Member and Contributor all carry Write. A consumer who needs RLS-enforced analysis gets Read or Build on the model, never a workspace role
- Viewer is the role that enforces RLS for people browsing a workspace; Viewers can Analyze in Excel or export data only with Build on the model
- Members can add users at equal or lower roles but cannot change or remove existing role assignments; only Admin can
- Disabling a user in Entra blocks access but leaves the workspace access records until the account is hard-deleted; revoke explicitly when the exit is permanent
- Build granted through a report or app audience cascades to that report's semantic models
- Dataflows do not support direct item sharing; use workspace roles
- Workspace apps: removing a user from an audience does not revoke their Read on cross-workspace semantic models granted through the app; clean up by hand or use org apps ([../../../wiki/org-apps.md](../../../wiki/org-apps.md)), which revoke everything
- Contributors can update a workspace app only if the Admin enabled "Allow contributors to update the app"
- Reports in an app that use semantic models in other workspaces need explicit Read on those models for each consumer
- Publish to web is public and unauthenticated, off by default, and not audited per view; restrict it to a security group

## Distribution and licensing

```yaml
distribute via apps, not workspace Viewer: apps hide clutter, give audiences, avoid accidental Write
free consumers: need F64 or larger Fabric capacity, P SKU or Premium; below F64 every consumer needs Pro or PPU
creators: always need Pro or PPU to author and share Power BI content
PPU workspace: everyone, consumers included, needs PPU
license vs permission: a license decides whether you can consume; permissions decide what you can do; neither grants the other
A and EM SKUs: embed-only, no Fabric items; new deployments should use F SKUs
```

- Embed for customers (app-owns-data): service principal recommended, end users need no Power BI license, content must sit on F, P, EM or A capacity; master users cannot embed paginated reports; the SP needs the tenant setting "Allow service principals to use Power BI APIs" and a spot in its allow group
- Embed for your organization: each viewer authenticates and needs a license (Free works on F64 or larger)
- External users: Entra B2B guest is the default; guests cannot Analyze in Excel, connect Desktop to service models, publish from Desktop, install a gateway or set sensitivity labels; in-place semantic model sharing allows cross-tenant composite models

## Deployment pipeline permissions

Pipeline access is separate from workspace roles and alone gives no content access; see [deployment-pipelines.md](./deployment-pipelines.md) for the matrix.

- Service principals can deploy through REST but cannot set OAuth credentials, cannot deploy dataflows, and become owner of deployed paginated reports and models, which breaks refresh; reassign ownership or deploy as a master user
- GCC needs Member on both source and target workspaces

## Related

- [../../../wiki/workspaces.md](../../../wiki/workspaces.md): workspace creation and settings
- [../../../wiki/gateways.md](../../../wiki/gateways.md): gateway and data source connection roles
- [../../../wiki/connections.md](../../../wiki/connections.md): connection roles
- `audit-tenant-settings` skill (fabric-admin plugin): baseline for export, sharing and access settings
