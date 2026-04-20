# Block secrets exposure

PreToolUse hooks that prevent agents from reading secrets, extracting tokens, or dumping credentials.

## What's blocked

### File access

| Pattern | Why |
|---------|-----|
| `Read(*.env)` / `Read(*.env.*)` | .env files contain API keys, passwords, connection strings |

Note: `.env.example` and `.env.template` are also blocked by these glob patterns. If you need to allow template files, add a more specific script-based hook that checks the filename.

### macOS Keychain

| Pattern | Why |
|---------|-----|
| `security find-generic-password` | Extracts stored passwords |
| `security find-internet-password` | Extracts stored web credentials |
| `security dump-keychain` | Dumps the entire keychain |

### Linux keyring

| Pattern | Why |
|---------|-----|
| `keyring get` | Python keyring CLI access |
| `secret-tool lookup` | GNOME keyring / libsecret access |

### Cloud CLI token extraction

| Pattern | Why |
|---------|-----|
| `az account get-access-token` | Azure CLI bearer token; agents should use DefaultAzureCredential in code |
| `aws sts get-session-token` | AWS session token; agents should use IAM roles or env vars |
| `gcloud auth print-access-token` | GCP access token extraction |
| `gcloud auth print-identity-token` | GCP identity token extraction |

### Environment dumping

| Pattern | Why |
|---------|-----|
| `printenv` | Dumps all env vars including secrets, tokens, API keys |

## What's NOT blocked

- Reading config files that don't contain secrets (`.env.example` aside)
- Using cloud CLIs for normal operations (`az group list`, `aws s3 ls`, `gcloud compute instances list`)
- Setting environment variables
- Reading non-sensitive files

## Why this matters

Agents operate with your credentials. When an agent runs `az account get-access-token`, that token goes into the conversation context and could be logged, cached, or sent to external tools. The safer pattern is to have the agent use SDK-level auth (DefaultAzureCredential, IAM roles) which never surfaces raw tokens.

Similarly, `printenv` dumps every environment variable. If you have `OPENAI_API_KEY`, `DATABASE_URL`, or `STRIPE_SECRET_KEY` set, those values land in context.

## Installation

Copy the hook entries from `settings.json.example` into your `~/.claude/settings.json` under `hooks.PreToolUse`.

Pick the hooks relevant to your platform (macOS vs Linux) and cloud providers. You don't need all of them.
