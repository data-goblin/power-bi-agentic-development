# Example: Complete Livy ETL Script

Tested and working script that creates a session, queries lakehouse data, writes a summary table, and cleans up.

```python
#!/usr/bin/env python3
"""Execute PySpark ETL on Fabric via Livy API -- no notebook needed."""

import json
import subprocess
import sys
import time
import urllib.request


WS_ID = "<workspace-id>"
LH_ID = "<lakehouse-id>"
LIVY_BASE = f"https://api.fabric.microsoft.com/v1/workspaces/{WS_ID}/lakehouses/{LH_ID}/livyapi/versions/2023-12-01"


def get_token():
    result = subprocess.run(
        ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("az CLI auth failed. Run 'az login' first.", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)["accessToken"]


def api(path, token, method="GET", body=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{LIVY_BASE}{path}", data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
        sys.exit(1)
    raw = resp.read().decode()
    return json.loads(raw) if raw else {}


def run_etl():
    token = get_token()

    # 1. Create session
    session = api("/sessions", token, "POST", {"kind": "pyspark"})
    session_id = session["id"]
    print(f"Session: {session_id}")

    try:
        # 2. Wait for idle
        for _ in range(60):
            state = api(f"/sessions/{session_id}", token).get("state")
            if state == "idle":
                break
            if state in ("dead", "error", "killed"):
                print(f"Session failed: {state}", file=sys.stderr)
                return
            time.sleep(5)

        # 3. Submit ETL code
        code = """
df = spark.sql("SELECT category, COUNT(*) as n, ROUND(AVG(price), 2) as avg_price FROM test_products GROUP BY category ORDER BY avg_price DESC")
df.show()
df.write.mode("overwrite").saveAsTable("product_summary")
verify = spark.sql("SELECT * FROM product_summary")
verify.show()
print(f"Rows written: {verify.count()}")
"""
        stmt = api(f"/sessions/{session_id}/statements", token, "POST", {
            "code": code, "kind": "pyspark"
        })

        # 4. Poll for result
        for _ in range(60):
            result = api(f"/sessions/{session_id}/statements/{stmt['id']}", token)
            if result.get("state") == "available":
                output = result["output"]
                if output["status"] == "ok":
                    print(output["data"]["text/plain"])
                else:
                    print(f"Error: {output.get('evalue', 'unknown')}", file=sys.stderr)
                break
            time.sleep(5)

    finally:
        # 5. ALWAYS clean up
        api(f"/sessions/{session_id}", token, "DELETE")
        print("Session deleted")


if __name__ == "__main__":
    run_etl()
```

## Output

```
Session: dcbac291-2311-4fd1-b847-3c65292dfc35
+-----------+-----+---------+
|category   |n    |avg_price|
+-----------+-----+---------+
|Tools      |2    |56.37    |
|Electronics|3    |51.66    |
|Accessories|3    |24.17    |
+-----------+-----+---------+

Wrote product_summary table
+-----------+-----+---------+
|category   |n    |avg_price|
+-----------+-----+---------+
|Tools      |2    |56.37    |
|Electronics|3    |51.66    |
|Accessories|3    |24.17    |
+-----------+-----+---------+

Rows written: 3
Session deleted
```
