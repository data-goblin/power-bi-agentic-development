# Useful stuff

Misc. useful shit for making Claude Code more effective, safe, or satisfying based on my personal experiences and research.

| What | Description |
|------|-------------|
| [`hooks/block-npm`](hooks/block-npm/) | Block `npm`, suggest `bun` |
| [`hooks/block-pip`](hooks/block-pip/) | Block `pip`/`pip3`, suggest `uv` |
| [`hooks/block-destructive-commands`](hooks/block-destructive-commands/) | Block `rm -rf ~/`, force push to main, `git reset --hard`, `chmod 777` |
| [`hooks/block-secrets-exposure`](hooks/block-secrets-exposure/) | Block .env reads, keychain/keyring access, cloud CLI token extraction |
| [`agent-scripts/`](agent-scripts/) | Helper scripts for installing and running agentic tooling (e.g. enabling Windows long paths so the Copilot CLI install doesn't blow up on `Filename too long`) |
| [`status-lines/`](status-lines/) | Claude Code statusline with host + cwd, git, model + effort, time, and usage meters; segmented for easy customization |
| [`agent-settings/`](agent-settings/) | Sanitized `~/.claude/settings.json` template with the five Bash safety hooks (rm -rf home, npm, pip, ssh, op read) and opinionated defaults |
| [`package-cooldowns/`](package-cooldowns/) | One-shot setup script that configures uv, bun, pnpm, npm, and pip to ignore packages released in the last 7 days. Reduces supply-chain blast radius |
