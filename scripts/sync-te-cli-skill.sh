#!/usr/bin/env bash
# Mirror the te-cli skill from its upstream home (github.com/TabularEditor/CLI)
# into this marketplace's tabular-editor plugin, and re-apply two local-only
# augmentations that upstream does not carry.
#
# What it does, every run:
#   1. Pull upstream SKILL.md + references/ (the skill is maintained upstream and
#      vendored here; this stops the copy from drifting).
#   2. Strip the upstream `version:` frontmatter (unsupported in this
#      marketplace; plugins version via plugin.json lockstep instead).
#   3. Keep the local references/pbir-cli-tandem.md (this repo maintains its own,
#      written against the pbir-cli plugin here; upstream's variant is ignored).
#   4. (Re)write references/get-te-cli.md -- a local-only reference telling the
#      agent how to download the `te` binary per platform and put it on PATH.
#   5. Re-inject the local-only SKILL.md content: the get-te-cli pointer under
#      the title, its entry in the References list, the AI-metadata bullet in
#      "Make bulk changes", and the "Bundled scripts" section. All survive every
#      sync because they are re-applied here.
#
# Upstream CHANGELOG/LICENSE/README are distribution metadata and are not vendored.
# Fail-open: no network / bad clone / missing upstream file leaves the current
# skill untouched and exits 0 (never blocks a git pull).
#
# Usage:
#   scripts/sync-te-cli-skill.sh                sync now
#   scripts/sync-te-cli-skill.sh --write-local  (re)write only the local-only
#                                               get-te-cli.md + pointer, no network
#   scripts/sync-te-cli-skill.sh --install-hook install a post-merge git hook so
#                                               every `git pull` runs this sync
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/plugins/tabular-editor/skills/te-cli"
UPSTREAM="https://github.com/TabularEditor/CLI.git"
SUBDIR="skills/te-cli"
GETREF="$DEST/references/get-te-cli.md"
POINTER='To get the `te` CLI yourself (as the agent), see [references/get-te-cli.md](references/get-te-cli.md).'

write_get_ref() {
  mkdir -p "$DEST/references"
  cat > "$GETREF" <<'GETREF_EOF'
# Get the `te` CLI binary (agent self-service)

The `te` (Tabular Editor CLI) binary is published per platform on a public CDN,
no account or auth needed:

    https://cdn.tabulareditor.com/files/cli/latest/te-<os>-<arch>.tar.gz   (.zip on Windows)

Pick the asset for the platform:

- macOS arm64 (Apple Silicon): `te-osx-arm64.tar.gz`
- macOS x64 (Intel): `te-osx-x64.tar.gz`
- Linux x64: `te-linux-x64.tar.gz`
- Linux arm64: `te-linux-arm64.tar.gz`
- Windows x64: `te-win-x64.zip`
- Windows arm64: `te-win-arm64.zip`

## macOS / Linux: detect, download, put on PATH

```bash
os=$(uname -s | tr 'A-Z' 'a-z'); [ "$os" = darwin ] && os=osx
arch=$(uname -m); case "$arch" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; esac
mkdir -p "$HOME/.local/bin"
curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-$os-$arch.tar.gz" \
  | tar xz -C "$HOME/.local/bin" te
chmod +x "$HOME/.local/bin/te"
export PATH="$HOME/.local/bin:$PATH"          # this shell
"$HOME/.local/bin/te" --version
```

Persist PATH across shells once (skip if `~/.local/bin` is already on PATH):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # or ~/.zshrc
```

## Windows (PowerShell): download, put on PATH

```powershell
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dir  = "$env:LOCALAPPDATA\Programs\te"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://cdn.tabulareditor.com/files/cli/latest/te-win-$arch.zip" -OutFile "$env:TEMP\te.zip"
Expand-Archive -Force "$env:TEMP\te.zip" -DestinationPath $dir
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path','User'));$dir", 'User')
& "$dir\te.exe" --version
```

## Verify and stay current

`te --version` prints the build. The CDN `latest` path is always the newest at
download time; for a binary that keeps itself current, use the self-updating
`te` wrapper instead (`te --update`, plus a daily check on `te --version`).

The CDN serves GET only; HEAD requests return 404. Probe availability with a
ranged GET (`curl -r 0-99 -o /dev/null -w "%{http_code}"`), never `curl -I`.
GETREF_EOF
}

inject_pointer() {
  # Idempotent: insert the pointer just after the first H1 if it is not already there.
  grep -qF 'references/get-te-cli.md' "$DEST/SKILL.md" 2>/dev/null && return 0
  local t; t="$(mktemp)" || return 0
  awk -v p="$POINTER" '
    { print }
    /^# / && !done { print ""; print p; done=1 }
  ' "$DEST/SKILL.md" > "$t" && mv "$t" "$DEST/SKILL.md"
}

inject_local_sections() {
  local skill="$DEST/SKILL.md" t

  # 1. AI-metadata bullet at the end of the "Make bulk changes" list, keyed off
  #    the macro-run bullet that closes it upstream.
  if ! grep -qF 'manage-ai-metadata.csx' "$skill"; then
    t="$(mktemp)" || return 0
    awk '
      { print }
      /te macro run "<name>" --on/ && !done {
        print "   - AI metadata CRUD: use `scripts/manage-ai-metadata.csx` for non-interactive `CustomInstructions` and Copilot schema `Entities` management; use `scripts/edit-ai-instructions-interactive.csx` or `scripts/edit-ai-schema-interactive.csx` inside TE3 Desktop."
        done=1
      }
    ' "$skill" > "$t" && mv "$t" "$skill"
  fi

  # 2. Bundled scripts section immediately above "## References".
  if ! grep -qF '## Bundled scripts' "$skill"; then
    t="$(mktemp)" || return 0
    awk '
      /^## References$/ && !done {
        print "## Bundled scripts"
        print ""
        print "- `scripts/manage-ai-metadata.csx` - non-interactive `te script` CRUD for"
        print "  semantic model AI instructions (`CustomInstructions`) and AI schema"
        print "  (`Entities`) stored in culture linguistic metadata."
        print "- `scripts/edit-ai-instructions-interactive.csx` - TE3 Desktop GUI editor for"
        print "  semantic model AI instructions."
        print "- `scripts/edit-ai-schema-interactive.csx` - TE3 Desktop GUI editor for"
        print "  semantic model AI schema."
        print "- `scripts/manage-ai-metadata-interactive.csx` - original combined TE3 Desktop"
        print "  editor prototype."
        print ""
        done=1
      }
      { print }
    ' "$skill" > "$t" && mv "$t" "$skill"
  fi

  # 3. get-te-cli.md entry at the top of the bundled-references list.
  if ! grep -qF '`references/get-te-cli.md`' "$skill"; then
    t="$(mktemp)" || return 0
    awk '
      /^- `references\/command-reference\.md`/ && !done {
        print "- `references/get-te-cli.md` - agent self-service install of the `te` binary from the public CDN"
        done=1
      }
      { print }
    ' "$skill" > "$t" && mv "$t" "$skill"
  fi
}

install_hook() {
  local hook="$REPO_ROOT/.git/hooks/post-merge"
  mkdir -p "$(dirname "$hook")"
  cat > "$hook" <<EOF
#!/usr/bin/env bash
# Auto-installed by scripts/sync-te-cli-skill.sh. Mirrors the te-cli skill from
# TabularEditor/CLI after every git pull. Safe to delete; re-add with
# 'scripts/sync-te-cli-skill.sh --install-hook'.
exec "$REPO_ROOT/scripts/sync-te-cli-skill.sh"
EOF
  chmod +x "$hook"
  printf 'installed post-merge hook -> %s\n' "$hook"
}

case "${1:-}" in
  --install-hook|install-hook) install_hook; exit 0 ;;
  --write-local) write_get_ref; inject_pointer; printf 'wrote local-only get-te-cli.md + SKILL pointer\n'; exit 0 ;;
  -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
esac

command -v git >/dev/null 2>&1 || { printf 'sync-te-cli: git not found; skipping\n' >&2; exit 0; }
[ -f "$DEST/SKILL.md" ] || { printf 'sync-te-cli: %s missing; skipping\n' "$DEST/SKILL.md" >&2; exit 0; }

tmp="$(mktemp -d "${TMPDIR:-/tmp}/te-cli-sync.XXXXXX")" || exit 0
trap 'rm -rf "$tmp"' EXIT

if ! git clone --depth 1 --quiet "$UPSTREAM" "$tmp" 2>/dev/null; then
  printf 'sync-te-cli: upstream clone failed (offline?); keeping current skill\n' >&2; exit 0
fi
SRC="$tmp/$SUBDIR"
{ [ -f "$SRC/SKILL.md" ] && [ -d "$SRC/references" ] && ls "$SRC/references/"*.md >/dev/null 2>&1; } || {
  printf 'sync-te-cli: upstream %s incomplete; aborting\n' "$SUBDIR" >&2; exit 0; }

cp "$SRC/SKILL.md" "$DEST/SKILL.md"
mkdir -p "$DEST/references"
# Drop upstream-managed references (keep the local-only ones), then copy upstream's.
find "$DEST/references" -maxdepth 1 -name '*.md' ! -name 'get-te-cli.md' ! -name 'pbir-cli-tandem.md' -delete 2>/dev/null
for f in "$SRC/references/"*.md; do
  case "$(basename "$f")" in pbir-cli-tandem.md) continue ;; esac
  cp "$f" "$DEST/references/"
done

# Strip the upstream version frontmatter (unsupported here; plugin.json versions instead).
perl -ni -e 'print unless !$d && /^version:/ && ($d=1)' "$DEST/SKILL.md"

# Re-apply the local-only augmentations (upstream does not carry these).
write_get_ref
inject_pointer
inject_local_sections

if git -C "$REPO_ROOT" diff --quiet -- plugins/tabular-editor/skills/te-cli 2>/dev/null; then
  printf 'sync-te-cli: up to date with upstream\n'
else
  printf 'sync-te-cli: te-cli skill updated from upstream; review and commit:\n'
  git -C "$REPO_ROOT" --no-pager diff --stat -- plugins/tabular-editor/skills/te-cli
fi
exit 0
