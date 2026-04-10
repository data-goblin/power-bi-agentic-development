# Tags

Manage tenant- and domain-scoped tags on Fabric items and workspaces via `fab api`. There is no native `fab tag` command yet; all tag operations go through the REST API.

## Why Tags

- **Governance** ; tenant- or domain-scoped classification for cost attribution, compliance, or project/FY labels without creating more workspaces
- **Discovery** ; global search, workspace/item lists, and OneLake Catalog all filter by tag; lineage views render tag chips on nodes
- **Bulk workflows** ; the standard item-get and workspace-get responses include a `tags` array, so audits and governance automation can pivot on tags instead of name patterns
- **Domain autonomy** ; domain admins govern their own tag namespace without touching tenant settings

Caps worth knowing: 10,000 unique tags per tenant, 10 tags per item, 10 tags per workspace (counted independently), 25 requests/minute/principal across all tag APIs.

## Endpoints

All paths use the default `fabric` audience. **`fab api` automatically prepends `/v1/`** ; use bare paths like `admin/tags`, not `/v1/admin/tags` (the latter returns 404 EntityNotFound).

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `tags` | List tenant + accessible domain tags (requires `Tag.Read.All` scope; returns 403 for default fab user tokens) |
| `GET`    | `admin/tags` | List tags (admin view; works with fab admin login) |
| `POST`   | `admin/tags/bulkCreateTags` | Create tenant or domain tags in bulk |
| `PATCH`  | `admin/tags/{tagId}` | Rename a tag |
| `DELETE` | `admin/tags/{tagId}` | Delete a tag (clears it from every item and workspace) |
| `POST`   | `workspaces/{workspaceId}/items/{itemId}/applyTags` | Apply tags to an item |
| `POST`   | `workspaces/{workspaceId}/items/{itemId}/unapplyTags` | Remove tags from an item |
| `POST`   | `workspaces/{workspaceId}/applyTags` | Apply tags to a workspace |
| `POST`   | `workspaces/{workspaceId}/unapplyTags` | Remove tags from a workspace |

To read the tags currently applied to a single item or workspace, the standard get endpoints already include a `tags` array in the response:

```bash
fab api "workspaces/$WS_ID/items/$ITEM_ID" -q "text.tags"
fab api "workspaces/$WS_ID" -q "text.tags"
```

No Scanner API call is needed for per-item tag discovery.

## List Tags

```bash
# Admin view (works for Fabric admins)
fab api "admin/tags" -q "text.value[].{id:id,name:displayName,scope:scope.type}"

# Core endpoint; needs Tag.Read.All on the token, returns 403 InsufficientScopes otherwise
fab api "tags" -q "text.value[].{id:id,name:displayName}"
```

## Create Tags (admin)

```bash
# Tenant-scoped
cat > /tmp/tags.json <<'EOF'
{
  "createTagsRequest": [
    {"displayName": "Finance FY26"},
    {"displayName": "HR FY26"}
  ]
}
EOF
fab api -X post "admin/tags/bulkCreateTags" -i /tmp/tags.json

# Domain-scoped
cat > /tmp/dtags.json <<'EOF'
{
  "scope": {"type": "Domain", "domainId": "<domainId>"},
  "createTagsRequest": [{"displayName": "Legal EMEA"}]
}
EOF
fab api -X post "admin/tags/bulkCreateTags" -i /tmp/dtags.json
```

Response is `201` with a `tags` array. Capture new tag IDs from the response envelope:

```bash
TAG_ID=$(fab api -X post "admin/tags/bulkCreateTags" -i /tmp/tags.json \
  -q "text.tags[?displayName=='Finance FY26'] | [0].id" | tr -d '"')
```

## Rename or Delete a Tag (admin)

```bash
# Rename
echo '{"displayName": "Finance FY27"}' > /tmp/rename.json
fab api -X patch "admin/tags/$TAG_ID" -i /tmp/rename.json

# Delete (removes the tag from every item and workspace that uses it)
fab api -X delete "admin/tags/$TAG_ID"
```

## Apply or Unapply Tags

```bash
WS_ID=$(fab get "Sales.Workspace" -q "id" | tr -d '"')
ITEM_ID=$(fab get "Sales.Workspace/Sales.SemanticModel" -q "id" | tr -d '"')

# Apply two tags to an item
echo '{"tags": ["'"$TAG_ID_1"'", "'"$TAG_ID_2"'"]}' > /tmp/apply.json
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/applyTags" -i /tmp/apply.json

# Remove one tag from the item
echo '{"tags": ["'"$TAG_ID_1"'"]}' > /tmp/unapply.json
fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/unapplyTags" -i /tmp/unapply.json

# Apply a tag to the workspace itself
fab api -X post "workspaces/$WS_ID/applyTags" -i /tmp/apply.json
```

Apply/unapply calls return `200` with an empty body. Request body shape is identical across all four endpoints: `{"tags": ["<tagId>", ...]}`. Apply is additive ; applying `[A]` after `[B]` leaves the item with `[A, B]`. Unapply removes only the listed IDs.

## Permissions

| Action | Required role / scope |
|---|---|
| Create, rename, delete tenant tags | Fabric administrator; `Tenant.ReadWrite.All` |
| Create, rename, delete domain tags | Fabric admin or Domain admin of that domain |
| List tags (admin endpoint)        | Admin; `Tenant.Read.All` |
| List tags (core endpoint)         | Any user; `Tag.Read.All` |
| Apply or unapply tags on an item  | Workspace Contributor or higher on the item |
| Apply or unapply tags on a workspace | Workspace Admin |

Service principals need **Service principals can access read-only admin APIs** (for admin list) or **... used for updates** (for create/patch/delete) in Tenant Settings, plus membership in an allowed security group.

## Common Workflows

### Tag every semantic model in a workspace

```bash
WS_ID=$(fab get "Sales.Workspace" -q "id" | tr -d '"')
TAG_ID=$(fab api "admin/tags" -q "text.value[?displayName=='Finance FY26'] | [0].id" | tr -d '"')

fab api "workspaces/$WS_ID/items?type=SemanticModel" \
  -q "text.value[].id" | jq -r '.[]' | while read ITEM_ID; do
  echo "{\"tags\":[\"$TAG_ID\"]}" > /tmp/apply.json
  fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/applyTags" -i /tmp/apply.json
done
```

### Find every item that carries a specific tag (workspace scoped)

```bash
TAG_ID=<tag-id>
fab api "workspaces/$WS_ID/items" \
  -q "text.value[?tags && contains(tags[].id, '$TAG_ID')].{id:id,name:displayName,type:type}"
```

For tenant-wide tag audits, loop over workspaces from `admin/workspaces` and filter each item list on the `tags[].id` array.

## Gotchas

- `fab api` prepends `/v1/` automatically. Passing `/v1/admin/tags` yields `404 EntityNotFound`
- The core `tags` endpoint returns `403 InsufficientScopes` under a default fab interactive login; use `admin/tags` if the caller is a Fabric admin
- Deleting a tag is irreversible and unapplies it from every item and workspace in a single operation; there is no dry run
- Hitting the 10-tag per item or per workspace cap returns `400`; the request does not partially apply
- Tag `displayName` is case-insensitive unique within its scope; domain-scoped tags can repeat across domains but cannot collide with a tenant tag name
- `fab api -q <jmespath>` filters run against `{status_code, text}`, so paths start with `text.value[...]` (list endpoints) or `text.tags[...]` (bulkCreateTags response)
- Apply and unapply return `200` with `Content-Length: 0`; `fab api`'s JSON parser handles this cleanly, but `-q` on the empty body returns `None`
