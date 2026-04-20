# Useful stuff

Misc. useful shit for making Claude Code more effective, safe, or satisfying based on my personal experiences and research.

| What | Description |
|------|-------------|
| [`hooks/block-npm`](hooks/block-npm/) | Block `npm`, suggest `bun` |
| [`hooks/block-pip`](hooks/block-pip/) | Block `pip`/`pip3`, suggest `uv` |
| [`hooks/block-destructive-commands`](hooks/block-destructive-commands/) | Block `rm -rf ~/`, force push to main, `git reset --hard`, `chmod 777` |
| [`hooks/block-secrets-exposure`](hooks/block-secrets-exposure/) | Block .env reads, keychain/keyring access, cloud CLI token extraction |
