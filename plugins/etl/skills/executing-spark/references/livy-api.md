# Livy API Reference

## Base URL

```
https://api.fabric.microsoft.com/v1/workspaces/{wsId}/lakehouses/{lhId}/livyapi/versions/2023-12-01
```

## Authentication

Bearer token with resource `https://api.fabric.microsoft.com`:

```python
import subprocess, json

result = subprocess.run(
    ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com"],
    capture_output=True, text=True
)
token = json.loads(result.stdout)["accessToken"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
```

## Endpoints

### Create Session

```
POST /sessions
```

**Request:**
```json
{"kind": "pyspark"}
```

Supported kinds: `pyspark`, `spark` (Scala), `sql`

**Response (202):**
```json
{"id": "<session-guid>", "artifactId": "<lakehouse-guid>"}
```

### Get Session State

```
GET /sessions/{sessionId}
```

**Key fields:**
- `state`: `not_started`, `starting`, `idle`, `busy`, `dead`, `error`, `killed`
- `livyInfo.currentState`: internal Livy state

Poll until `state: "idle"` before submitting code. Typical cold start: 30-90 seconds.

### Submit Statement

```
POST /sessions/{sessionId}/statements
```

**Request:**
```json
{"code": "print('hello')", "kind": "pyspark"}
```

**Response (200):**
```json
{"id": 1, "code": "print('hello')", "state": "waiting"}
```

### Get Statement Result

```
GET /sessions/{sessionId}/statements/{statementId}
```

**Response when complete:**
```json
{
  "id": 1,
  "state": "available",
  "output": {
    "status": "ok",
    "execution_count": 1,
    "data": {"text/plain": "hello"}
  }
}
```

**Response on error:**
```json
{
  "id": 1,
  "state": "available",
  "output": {
    "status": "error",
    "ename": "AnalysisException",
    "evalue": "Table or view not found",
    "traceback": ["..."]
  }
}
```

Statement states: `waiting`, `running`, `available`, `error`, `cancelling`, `cancelled`

### Delete Session

```
DELETE /sessions/{sessionId}
```

**Response:** 200 with empty body.

### List Sessions

```
GET /sessions
```

Returns all active sessions for the lakehouse. Use to find orphaned sessions.

## Helper Function

```python
import json, time, urllib.request

def api(base_url, path, token, method="GET", body=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{base_url}{path}", data=data, method=method, headers=headers)
    resp = urllib.request.urlopen(req)
    raw = resp.read().decode()
    return json.loads(raw) if raw else {}
```

## Session Configuration

Pass Spark configuration when creating the session:

```json
{
  "kind": "pyspark",
  "conf": {
    "spark.sql.shuffle.partitions": "200",
    "spark.fabric.environmentDetails": "{\"id\": \"<environment-guid>\"}"
  },
  "driverMemory": "56g",
  "driverCores": 8,
  "executorMemory": "56g",
  "executorCores": 8,
  "numExecutors": 2
}
```

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `REQUEST_INVALID_RESOURCE_NONRETRIABLE` | Token lacks storage scopes | Use `az` CLI token, not `fab` token |
| `MetaException: Unable to fetch mwc token` | Same auth issue | Same fix |
| Session state `dead` immediately | Bad config or capacity issue | Check Monitoring Hub in Fabric portal |
| Statement `NameError: spark` | Session kind mismatch | Use `kind: "pyspark"` for Python code |

## Microsoft Documentation

- [Livy API Overview](https://learn.microsoft.com/en-us/fabric/data-engineering/api-livy-overview)
- [Submit Session Jobs](https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-session)
- [Submit Batch Jobs](https://learn.microsoft.com/en-us/fabric/data-engineering/get-started-api-livy-batch)
- [Livy API Swagger](https://github.com/microsoft/fabric-samples/blob/main/docs-samples/data-engineering/Livy-API-swagger/swagger.json)
