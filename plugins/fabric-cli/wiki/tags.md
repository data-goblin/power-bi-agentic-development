---
title: Fabric tags with fab api
summary: List, create, apply and remove tenant and domain tags; admin versus core endpoints, scopes, caps and the 404 and 403 traps.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/core/tags
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/admin/tags
  - url: https://learn.microsoft.com/en-us/rest/api/fabric/admin/tags/bulk-create-tags
tools:
  fab: 1.7.0
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [fabric-cli/fabric-cli]
---

# Fabric tags with fab api

Learn: [Core Tags (apply, unapply, list)](https://learn.microsoft.com/en-us/rest/api/fabric/core/tags), [Admin Tags (create, update, delete, list)](https://learn.microsoft.com/en-us/rest/api/fabric/admin/tags), [Bulk Create Tags](https://learn.microsoft.com/en-us/rest/api/fabric/admin/tags/bulk-create-tags).

fab 1.7.0 has no tag command; everything goes through `fab api` on the default Fabric audience.

## Endpoints

```yaml
list, admin view: GET admin/tags (needs a Fabric admin; verified working)
list, core: GET tags (needs the Tag.Read.All scope)
create tenant or domain tags: POST admin/tags/bulkCreateTags
rename: PATCH admin/tags/<tagId>
delete: DELETE admin/tags/<tagId>
apply or unapply on an item: POST workspaces/<ws>/items/<item>/applyTags and unapplyTags
apply or unapply on a workspace: POST workspaces/<ws>/applyTags and unapplyTags
```

## Verified traps (fab 1.7.0, default interactive login)

- `fab api tags` returns status 403 with `errorCode` `InsufficientScopes`; use `admin/tags` as a Fabric admin.
- `fab api "/v1/admin/tags"` returns 404: fab adds `/v1/` itself, so write `admin/tags`.
- `-q` runs against `{status_code, text}`: `text.value[].displayName` works, `value[].displayName` prints `None`.

## Other gotchas

- Caps: 10,000 tags per tenant, 10 per item, 10 per workspace (independent counts). The earlier note said hitting the cap returns 400 without partial apply; Unverified.
- Bulk create and the other admin writes are limited to 25 requests per minute per principal; creating needs `Tenant.ReadWrite.All`. A `displayName` is at most 40 characters and a duplicate name returns `EntityConflict`.
- Create body: `{"createTagsRequest": [{"displayName": "Finance FY26"}]}`; add `"scope": {"type": "Domain", "domainId": "<id>"}` for domain tags. Response is `201` with a `tags` array carrying each new id.
- Apply and unapply take `{"tags": ["<tagId>"]}` and return `200` with an empty body; apply is additive, unapply removes only the listed ids.
- Deleting a tag removes it from every item and workspace at once; there is no dry run.
- Applying tags to an item needs contributor or higher; to a workspace needs workspace admin.
- Item payloads carry a `tags` array (`id`, `displayName`), so a list of items can be filtered by tag without the Scanner API.
- Service principals need the tenant settings for read-only admin APIs (list) or admin API updates (create, rename, delete), plus membership in an allowed security group.

## Example: tag every semantic model in a workspace

```bash
WS_ID=$(fab get "Sales.Workspace" -q id)
TAG_ID=$(fab api "admin/tags" -q "text.value[?displayName=='Finance FY26'] | [0].id")
echo "{\"tags\": [\"$TAG_ID\"]}" > apply.json
for ITEM_ID in $(fab api "workspaces/$WS_ID/items?type=SemanticModel" -q "text.value[].id" | jq -r '.[]'); do
  fab api -X post "workspaces/$WS_ID/items/$ITEM_ID/applyTags" -i apply.json
done
```

Find items by tag: `fab api "workspaces/$WS_ID/items" -q "text.value[?tags && contains(tags[].id, '$TAG_ID')].{id:id, name:displayName}"`. Unverified: writes and the file-path form of `-i` were not run on fab 1.7.0.
