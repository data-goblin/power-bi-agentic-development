#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# ///
import base64
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

API = "https://api.fabric.microsoft.com/v1"
SETTING = "RScriptVisual"
PATTERN = re.compile(rb'\\?"visualType\\?"\s*:\s*\\?"(scriptVisual|pythonVisual|rVisual)\\?"')
PBI = "https://api.powerbi.com/v1.0/myorg"


def token(resource: str) -> str:
    cmd = ["az", "account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv"]
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout.strip()


TOKENS = {API: token("https://api.fabric.microsoft.com"), PBI: token("https://analysis.windows.net/powerbi/api")}


def call(method: str, url: str) -> tuple[int, dict, dict]:
    for attempt in range(8):
        req = urllib.request.Request(url, method=method, headers={"Authorization": f"Bearer {TOKENS[url[:len(API)] if url.startswith(API) else PBI]}", "Content-Type": "application/json"}, data=b"{}" if method == "POST" else None)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
                return r.status, dict(r.headers), json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500:
                body = e.read()
                return e.code, dict(e.headers), json.loads(body) if body else {}
            time.sleep(int(e.headers.get("Retry-After") or 2 ** attempt))
    return 429, {}, {}


def pages(url: str, key: str) -> list[dict]:
    out = []
    while url:
        body = call("GET", url)[2]
        out += body.get(key, [])
        url = body.get("continuationUri")
    return out


def scan(r: dict) -> dict:
    row = {"workspace": WORKSPACES.get(r["workspaceId"], r["workspaceId"]), "reportId": r["id"], "name": r["name"]}
    status, headers, body = call("POST", f"{API}/workspaces/{r['workspaceId']}/reports/{r['id']}/getDefinition")
    while status == 202 or body.get("status") in ("NotStarted", "Running"):
        time.sleep(0.5)
        status, _, body = call("GET", headers["Location"])
    if body.get("status") == "Succeeded":
        status, _, body = call("GET", headers["Location"] + "/result")
    if status != 200 or "definition" not in body:
        return row | {"status": "unreadable"}
    hits = Counter(m.group(1).decode() for p in body["definition"]["parts"] for m in PATTERN.finditer(base64.b64decode(p["payload"])))
    return row | {"status": "scanned", "hits": dict(hits)}


body = call("GET", f"{API}/admin/tenantsettings")[2]
settings = body.get("value") or body["tenantSettings"]
if not next(s for s in settings if s["settingName"] == SETTING)["enabled"]:
    sys.exit(print(json.dumps({"setting": SETTING, "enabled": False})))
workspaces = pages(f"{API}/admin/workspaces", "workspaces")
WORKSPACES = {w["id"]: w["name"] for w in workspaces}
system = {w["id"] for w in workspaces if w["type"] == "AdminWorkspace"}
reports = [
    r for r in call("GET", f"{PBI}/admin/reports")[2]["value"]
    if r["reportType"] == "PowerBIReport" and "/reportEmbed?" in r["embedUrl"] and r["workspaceId"] not in system
    and "appId" not in r and "originalReportObjectId" not in r
]
with ThreadPoolExecutor(int(sys.argv[1]) if len(sys.argv) > 1 else 32) as ex:
    rows = list(ex.map(scan, reports))
print(json.dumps({
    "setting": SETTING, "enabled": True, "reports": len(rows),
    "scanned": sum(r["status"] == "scanned" for r in rows),
    "unreadable": [r for r in rows if r["status"] == "unreadable"],
    "withScriptVisuals": [r for r in rows if r.get("hits")],
}, indent=2))
