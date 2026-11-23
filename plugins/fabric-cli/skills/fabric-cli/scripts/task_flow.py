#!/usr/bin/env python3
"""
Read, create, update and delete a Fabric workspace task flow from a JSON spec.

Task flows have no public REST API and no fab command. The workspace UI talks to
the Power BI metadata backend on the tenant's cluster, and this script calls the
same endpoints with an az token for the Power BI resource:

    GET    {cluster}/metadata/workspaces/{ws}/taskflow202602                 list flows [{etag, resourceId, taskFlow}]
    POST   {cluster}/metadata/workspaces/{ws}/taskflow202512                 create; Location ends in the resourceId
    PUT    {cluster}/metadata/workspaces/{ws}/taskflow202512/{resourceId}    replace; needs If-Match: <etag>
    DELETE {cluster}/metadata/workspaces/{ws}/taskflow202512/{resourceId}    delete;  needs If-Match: <etag>
    GET    {cluster}/metadata/artifacts/definitions                          internal artifactType per public item type
    GET    https://api.powerbi.com/powerbi/globalservice/v201606/clusterdetails   the cluster URL

These are internal endpoints, observed from the Fabric UI; they can change without notice.

Fabric items are stored as "<artifactType>:<item guid>" with the internal artifact type
(Notebook is SynapseNotebook, DataPipeline is Pipeline, SQLEndpoint is
SqlAnalyticsEndpoint, GraphModel is GraphIndex); the script reads that mapping from the
definitions endpoint. Power BI items keep their classic form, and the UI ignores them
in any other: a report is "2:<guid>" with type "report", a semantic model is
"3:<numeric model id>" with type "dataset" and a null object id (the numeric id comes
from {cluster}/metadata/models/{guid}). Dashboards, paginated reports and datamarts use
classic codes that have not been observed, so the script refuses them. A spec names
items the way fab does: "<displayName>.<Type>".

Spec
----
    {
      "name": "Order to cash",
      "description": "optional",
      "tasks": [
        {"key": "get",   "type": "get data",   "name": "Get data", "loc": [-780, 60],
         "items": ["load.DataPipeline", "load.Notebook"]},
        {"key": "store", "type": "store data", "name": "Store",    "loc": [-360, 60],
         "items": ["lh.Lakehouse", "lh.SQLEndpoint"], "description": "optional"}
      ],
      "edges": [["get", "store"]]
    }

    type:  general, get data, mirror data, store data, prepare data, analyze and train data,
           develop, visualize, track data, distribute data, govern data
    loc:   canvas position [x, y]; tasks are about 300 wide, so space them 380-420 apart
    items: "<displayName>.<Type>", {"id": "<item guid>"}, or a backend item object passed as is;
           an item may sit in one task only
    edges: [sourceKey, targetKey]; the arrow points from source to target

`apply` updates the workspace's flow in place when one exists (task and edge ids are
kept where the task name or the edge endpoints match, so the canvas does not jump),
and creates one otherwise. `get` prints a flow as a spec that `apply` takes back.

Usage
-----
    uv run task_flow.py list  "Sales"                         # flows in a workspace (name or id)
    uv run task_flow.py get   "Sales" > flow.json             # current flow as an apply-able spec
    uv run task_flow.py get   "Sales" --raw                   # the backend JSON as stored
    uv run task_flow.py apply "Sales" -s flow.json            # create or update from a spec
    uv run task_flow.py apply "Sales" -s flow.json --dry-run  # print the body, send nothing
    uv run task_flow.py rename "Sales" "Order to cash" [--description "..."]
    uv run task_flow.py delete "Sales" --flow "Order to cash"
    uv run task_flow.py types                                 # public item type -> artifactType

Exit codes: 0 done; 1 operational error (auth, HTTP, unknown item or task key).

Requirements
------------
    - Azure CLI logged in (`az login`); tokens are read from the az cache, never persisted
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

FABRIC_API = "https://api.fabric.microsoft.com/v1"
FABRIC_RESOURCE = "https://api.fabric.microsoft.com"
PBI_RESOURCE = "https://analysis.windows.net/powerbi/api"
CLUSTER_DETAILS = "https://api.powerbi.com/powerbi/globalservice/v201606/clusterdetails"
LIST_PATH = "taskflow202602"
WRITE_PATH = "taskflow202512"
CLASSIC = {"Report": ("2", "report"), "SemanticModel": ("3", "dataset")}
UNMAPPED = {"Dashboard", "PaginatedReport", "Datamart"}
TASK_TYPES = [
    "general", "get data", "mirror data", "store data", "prepare data",
    "analyze and train data", "develop", "visualize", "track data",
    "distribute data", "govern data",
]


#region HTTP + auth


_TOKENS: dict[str, str] = {}


def token(resource: str) -> str:
    """Bearer token for a resource from the current az login. Never logged."""
    if resource not in _TOKENS:
        try:
            res = subprocess.run(
                ["az", "account", "get-access-token", "--resource", resource],
                capture_output=True, text=True, check=True,
            )
        except subprocess.CalledProcessError:
            fail("az could not get a token. Run 'az login' first.")
        except FileNotFoundError:
            fail("Azure CLI (az) not found. Install it and run 'az login'.")
        _TOKENS[resource] = json.loads(res.stdout)["accessToken"]
    return _TOKENS[resource]


def fail(message: str):
    print(message, file=sys.stderr)
    sys.exit(1)


def call(method: str, url: str, resource: str, body: dict | None = None,
         headers: dict | None = None) -> tuple[dict, object]:
    """Send a request; return (response headers, parsed JSON or None)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token(resource)}",
        "Content-Type": "application/json",
        **(headers or {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return dict(resp.getheaders()), (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        fail(f"HTTP {e.code} on {method} {url}: {e.read().decode()[:400]}")
    except urllib.error.URLError as e:
        fail(f"Request to {url} failed: {e}")


def header(headers: dict, name: str) -> str | None:
    return next((v for k, v in headers.items() if k.lower() == name.lower()), None)


#endregion


#region Resolution


def cluster() -> str:
    _, body = call("GET", CLUSTER_DETAILS, PBI_RESOURCE)
    return body["clusterUrl"].rstrip("/")


def fabric_pages(url: str) -> list[dict]:
    out = []
    while url:
        _, body = call("GET", url, FABRIC_RESOURCE)
        out += body.get("value", [])
        url = body.get("continuationUri")
    return out


def resolve_workspace(ref: str) -> str:
    try:
        return str(uuid.UUID(ref))
    except ValueError:
        pass
    name = ref.removesuffix(".Workspace")
    hits = [w["id"] for w in fabric_pages(f"{FABRIC_API}/workspaces") if w["displayName"] == name]
    if len(hits) != 1:
        fail(f"Workspace '{name}': {len(hits)} matches")
    return hits[0]


def artifact_types(base: str) -> dict[str, str]:
    """Public item type -> internal artifactType, preferring an exact name match."""
    _, defs = call("GET", f"{base}/metadata/artifacts/definitions", PBI_RESOURCE)
    out: dict[str, str] = {}
    for d in defs:
        public = d.get("publicFacingArtifactName")
        if public and (public not in out or d["artifactType"] == public):
            out[public] = d["artifactType"]
    return out


#endregion


#region Flows


def flows(base: str, ws: str) -> list[dict]:
    _, body = call("GET", f"{base}/metadata/workspaces/{ws}/{LIST_PATH}", PBI_RESOURCE)
    return body or []


def pick(found: list[dict], ref: str | None) -> dict | None:
    if ref:
        hits = [f for f in found if ref in (f["resourceId"], f["taskFlow"].get("id"), f["taskFlow"].get("name"))]
        if len(hits) != 1:
            fail(f"Task flow '{ref}': {len(hits)} matches")
        return hits[0]
    if len(found) > 1:
        fail(f"{len(found)} task flows in the workspace; name one with --flow")
    return found[0] if found else None


def model_id(base: str, guid: str) -> int:
    """Numeric Power BI model id, which task flows use for semantic models."""
    _, body = call("GET", f"{base}/metadata/models/{guid}", PBI_RESOURCE)
    return body["model"]["id"]


def to_spec(flow: dict, items: dict[str, dict], base: str) -> dict:
    uids = {}
    for oid, it in items.items():
        if it["type"] == "SemanticModel":
            uids[f"{CLASSIC['SemanticModel'][0]}:{model_id(base, oid)}"] = it
        elif it["type"] in CLASSIC:
            uids[f"{CLASSIC[it['type']][0]}:{oid}"] = it
    keys = {t["id"]: f"t{i + 1}" for i, t in enumerate(flow.get("tasks", []))}
    tasks = []
    for t in flow.get("tasks", []):
        x, y = (float(v) for v in t.get("loc", "0 0").split())
        loc = [int(v) if v.is_integer() else v for v in (x, y)]
        task = {"key": keys[t["id"]], "type": t["type"], "name": t["name"], "loc": loc}
        if t.get("description"):
            task["description"] = t["description"]
        refs = []
        for i in t.get("items", []):
            it = uids.get(i["artifactUniqueId"]) or items.get(i.get("artifactObjectId"))
            refs.append(f"{it['displayName']}.{it['type']}" if it else i)
        task["items"] = refs
        tasks.append(task)
    spec = {"name": flow.get("name", "")}
    if flow.get("description"):
        spec["description"] = flow["description"]
    spec["tasks"] = tasks
    spec["edges"] = [[keys[e["source"]], keys[e["target"]]] for e in flow.get("edges", [])]
    return spec


def build(spec: dict, items: list[dict], types: dict[str, str], previous: dict | None, base: str) -> dict:
    by_path = {f"{i['displayName']}.{i['type']}": i for i in items}
    by_id = {i["id"]: i for i in items}
    old_tasks = {t["name"]: t["id"] for t in (previous or {}).get("tasks", [])}
    old_edges = {(e["source"], e["target"]): e["id"] for e in (previous or {}).get("edges", [])}

    def item(ref) -> dict:
        if isinstance(ref, dict) and "artifactUniqueId" in ref:
            return ref
        if isinstance(ref, str):
            it = by_path.get(ref) or fail(f"No item '{ref}' in the workspace (use <displayName>.<Type>)")
        else:
            it = by_id.get(ref["id"]) or fail(f"No item with id {ref['id']} in the workspace")
        oid, public = it["id"], it["type"]
        if public in UNMAPPED:
            fail(f"'{it['displayName']}' is a {public}; its task flow id form is unknown, attach it in the UI")
        if public in CLASSIC:
            code, kind = CLASSIC[public]
            if public == "SemanticModel":
                return {"artifactUniqueId": f"{code}:{model_id(base, oid)}", "artifactType": kind, "artifactObjectId": None}
            return {"artifactUniqueId": f"{code}:{oid}", "artifactType": kind, "artifactObjectId": oid}
        internal = types.get(public) or fail(f"No artifactType for item type '{public}'")
        return {"artifactUniqueId": f"{internal}:{oid}", "artifactType": internal, "artifactObjectId": oid}

    ids: dict[str, str] = {}
    tasks = []
    for t in spec["tasks"]:
        if t["type"] not in TASK_TYPES:
            fail(f"Task '{t['name']}': type '{t['type']}' is not one of {', '.join(TASK_TYPES)}")
        tid = old_tasks.get(t["name"]) or str(uuid.uuid4())
        ids[t["key"]] = tid
        task = {"id": tid, "type": t["type"], "name": t["name"]}
        if t.get("description"):
            task["description"] = t["description"]
        task["items"] = [item(r) for r in t.get("items", [])]
        x, y = t.get("loc", [0, 0])
        task["loc"] = f"{x:g} {y:g}"
        tasks.append(task)

    seen = [i["artifactUniqueId"] for t in tasks for i in t["items"]]
    dupes = sorted({i for i in seen if seen.count(i) > 1})
    if dupes:
        fail(f"Items in more than one task: {', '.join(dupes)}")

    edges = []
    for src, dst in spec.get("edges", []):
        if src not in ids or dst not in ids:
            fail(f"Edge {src} -> {dst}: unknown task key")
        s, d = ids[src], ids[dst]
        edges.append({"id": old_edges.get((s, d)) or str(uuid.uuid4()), "source": s, "target": d,
                      "fromPort": None, "toPort": None})

    flow = {"tasks": tasks, "edges": edges, "id": (previous or {}).get("id") or str(uuid.uuid4()),
            "name": spec["name"]}
    if spec.get("description"):
        flow["description"] = spec["description"]
    return flow


#endregion


#region Commands


def cmd_list(args):
    base, ws = cluster(), resolve_workspace(args.workspace)
    found = flows(base, ws)
    if args.format == "json":
        print(json.dumps([{"resourceId": f["resourceId"], "id": f["taskFlow"].get("id"),
                           "name": f["taskFlow"].get("name"), "tasks": len(f["taskFlow"].get("tasks", [])),
                           "edges": len(f["taskFlow"].get("edges", []))} for f in found], indent=2))
        return
    for f in found:
        t = f["taskFlow"]
        print(f"{t.get('name')}\t{f['resourceId']}\t{len(t.get('tasks', []))} tasks\t{len(t.get('edges', []))} edges")


def cmd_get(args):
    base, ws = cluster(), resolve_workspace(args.workspace)
    flow = pick(flows(base, ws), args.flow) or fail("No task flow in the workspace")
    if args.raw:
        print(json.dumps(flow, indent=2))
        return
    items = {i["id"]: i for i in fabric_pages(f"{FABRIC_API}/workspaces/{ws}/items")}
    print(json.dumps(to_spec(flow["taskFlow"], items, base), indent=2))


def cmd_apply(args):
    with open(args.spec) as fh:
        spec = json.load(fh)
    base, ws = cluster(), resolve_workspace(args.workspace)
    current = pick(flows(base, ws), args.flow)
    items = fabric_pages(f"{FABRIC_API}/workspaces/{ws}/items")
    body = build(spec, items, artifact_types(base), current["taskFlow"] if current else None, base)
    if args.dry_run:
        print(json.dumps(body, indent=2))
        return
    root = f"{base}/metadata/workspaces/{ws}/{WRITE_PATH}"
    if current:
        call("PUT", f"{root}/{current['resourceId']}", PBI_RESOURCE, body, {"If-Match": current["etag"]})
        rid, action = current["resourceId"], "updated"
    else:
        headers, _ = call("POST", root, PBI_RESOURCE, body)
        rid = (header(headers, "Location") or "").rstrip("/").rsplit(f"{WRITE_PATH}/", 1)[-1]
        action = "created"
    result = {"action": action, "resourceId": rid, "name": body["name"],
              "tasks": len(body["tasks"]), "edges": len(body["edges"]),
              "items": sum(len(t["items"]) for t in body["tasks"])}
    if args.format == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"{action} '{result['name']}' ({rid}): {result['tasks']} tasks, {result['edges']} edges, {result['items']} items")


def cmd_rename(args):
    base, ws = cluster(), resolve_workspace(args.workspace)
    flow = pick(flows(base, ws), args.flow) or fail("No task flow in the workspace")
    body = {**flow["taskFlow"], "name": args.name}
    if args.description is not None:
        body["description"] = args.description
    call("PUT", f"{base}/metadata/workspaces/{ws}/{WRITE_PATH}/{flow['resourceId']}",
         PBI_RESOURCE, body, {"If-Match": flow["etag"]})
    print(f"renamed '{flow['taskFlow'].get('name')}' to '{args.name}' ({flow['resourceId']})")


def cmd_delete(args):
    base, ws = cluster(), resolve_workspace(args.workspace)
    flow = pick(flows(base, ws), args.flow) or fail("No task flow in the workspace")
    call("DELETE", f"{base}/metadata/workspaces/{ws}/{WRITE_PATH}/{flow['resourceId']}",
         PBI_RESOURCE, headers={"If-Match": flow["etag"]})
    print(f"deleted '{flow['taskFlow'].get('name')}' ({flow['resourceId']})")


def cmd_types(args):
    types = artifact_types(cluster())
    if args.format == "json":
        print(json.dumps(dict(sorted(types.items())), indent=2))
        return
    for public, internal in sorted(types.items()):
        print(f"{public}\t{internal}")


#endregion


def main():
    p = argparse.ArgumentParser(description="Manage Fabric workspace task flows from a JSON spec.")
    p.add_argument("--format", choices=["text", "json"], default="text")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("list", help="task flows in a workspace")
    s.add_argument("workspace", help="workspace name or id")
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("get", help="print a task flow as a spec")
    s.add_argument("workspace")
    s.add_argument("--flow", help="flow name, id or resourceId (needed only when there are several)")
    s.add_argument("--raw", action="store_true", help="print the backend JSON instead of a spec")
    s.set_defaults(func=cmd_get)

    s = sub.add_parser("apply", help="create or update a task flow from a spec")
    s.add_argument("workspace")
    s.add_argument("-s", "--spec", required=True, help="JSON spec file")
    s.add_argument("--flow", help="flow to update (needed only when there are several)")
    s.add_argument("--dry-run", action="store_true", help="print the request body and send nothing")
    s.set_defaults(func=cmd_apply)

    s = sub.add_parser("rename", help="rename a task flow, optionally setting its description")
    s.add_argument("workspace")
    s.add_argument("name", help="new name")
    s.add_argument("--description", help="new description")
    s.add_argument("--flow", help="flow to rename (needed only when there are several)")
    s.set_defaults(func=cmd_rename)

    s = sub.add_parser("delete", help="delete a task flow")
    s.add_argument("workspace")
    s.add_argument("--flow", help="flow name, id or resourceId (needed only when there are several)")
    s.set_defaults(func=cmd_delete)

    s = sub.add_parser("types", help="public item type to internal artifactType")
    s.set_defaults(func=cmd_types)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
