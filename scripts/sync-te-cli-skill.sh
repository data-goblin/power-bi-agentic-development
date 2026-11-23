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

Install `te` only when the user asks for it. Official install and update notes: https://docs.tabulareditor.com/en/cli/

The binary is published per platform on a public CDN, no account needed:

    https://cdn.tabulareditor.com/files/latest/cli/te-<os>-<arch>.tar.gz   (.zip on Windows)

Assets: `te-osx-arm64`, `te-osx-x64`, `te-linux-x64`, `te-linux-arm64` (`.tar.gz`), `te-win-x64`, `te-win-arm64` (`.zip`).

The CDN publishes no checksum or signature (`.sha256`, `.sig` and `SHA256SUMS` next to the archive returned 404 on 2026-11-23). Say that to the user before installing; do not pipe the download into `tar` or a shell. Download to a file, print its SHA256, extract, then check the binary runs.

## macOS / Linux

```bash
os=$(uname -s | tr 'A-Z' 'a-z'); [ "$os" = darwin ] && os=osx
arch=$(uname -m); case "$arch" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; esac
dir=$(mktemp -d)
curl -fsSL -o "$dir/te.tar.gz" "https://cdn.tabulareditor.com/files/latest/cli/te-$os-$arch.tar.gz"
sha256sum "$dir/te.tar.gz" 2>/dev/null || shasum -a 256 "$dir/te.tar.gz"
mkdir -p "$HOME/.local/bin"
tar -xzf "$dir/te.tar.gz" -C "$HOME/.local/bin" te
"$HOME/.local/bin/te" --version
```

Add `~/.local/bin` to `PATH` in the shell profile if it is not there.

## Windows (PowerShell)

```powershell
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dir  = "$env:LOCALAPPDATA\Programs\te"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://cdn.tabulareditor.com/files/latest/cli/te-win-$arch.zip" -OutFile "$env:TEMP\te.zip"
(Get-FileHash "$env:TEMP\te.zip" -Algorithm SHA256).Hash
Expand-Archive -Force "$env:TEMP\te.zip" -DestinationPath $dir
& "$dir\te.exe" --version
```

Add `$dir` to the user `Path` if it is not there.

## Notes

- `te --version` prints the build. `latest` is the newest build at download time
- The CDN answers GET only; HEAD returns 404. Probe a file with a ranged GET (`curl -r 0-99 -o /dev/null -w "%{http_code}"`)
- Preview builds stop working after 2026-12-31 (Learn: te-cli-limitations); check the docs for the licence that follows
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

  if ! grep -qF '`references/dax-test-patterns.md`' "$skill"; then
    t="$(mktemp)" || return 0
    awk '
      { print }
      /^- `references\/testing\.md`/ && !done {
        print "- `references/dax-test-patterns.md` - what to test: measure contracts (additivity, time shift, blank, safe division, bounds), integrity and schema checks, verified suite examples, CI tagging"
        done=1
      }
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

check_upstream() {
  local have head
  have="$(sed -n 's/^commit:[[:space:]]*//p' "$DEST/UPSTREAM.txt" 2>/dev/null | head -1)"
  head="$(git ls-remote "$UPSTREAM" HEAD 2>/dev/null | cut -f1)"
  [ -n "$head" ] || { printf 'sync-te-cli: cannot reach upstream; no verdict\n' >&2; return 0; }
  if [ "$have" = "$head" ]; then printf 'sync-te-cli: vendored copy is at upstream HEAD %s\n' "$head"; return 0; fi
  printf 'sync-te-cli: upstream HEAD %s is ahead of vendored %s; run scripts/sync-te-cli-skill.sh\n' "$head" "${have:-unknown}" >&2
  return 1
}

case "${1:-}" in
  --install-hook|install-hook) install_hook; exit 0 ;;
  --write-local) write_get_ref; inject_pointer; printf 'wrote local-only get-te-cli.md + SKILL pointer\n'; exit 0 ;;
  --check) check_upstream; exit $? ;;
  -h|--help) sed -n '2,38p' "$0"; exit 0 ;;
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
find "$DEST/references" -maxdepth 1 -name '*.md' ! -name 'get-te-cli.md' ! -name 'pbir-cli-tandem.md' ! -name 'dax-test-patterns.md' -delete 2>/dev/null
for f in "$SRC/references/"*.md; do
  case "$(basename "$f")" in pbir-cli-tandem.md) continue ;; esac
  cp "$f" "$DEST/references/"
done

UP_VERSION="$(sed -n 's/^version:[[:space:]]*//p' "$SRC/SKILL.md" | head -1)"
UP_COMMIT="$(git -C "$tmp" rev-parse HEAD 2>/dev/null)"
UP_DATE="$(git -C "$tmp" log -1 --format=%cs 2>/dev/null)"
UP_FILES="$(cd "$SRC/references" && ls -1 *.md | grep -v '^pbir-cli-tandem.md$' | tr '\n' ' ')"
{
  printf 'repo: TabularEditor/CLI\npath: skills/te-cli\nskill_version: %s\ncommit: %s\ncommit_date: %s\nsynced: %s\n' "${UP_VERSION:-unknown}" "${UP_COMMIT:-unknown}" "${UP_DATE:-unknown}" "$(date +%F)"
  printf 'upstream_files: SKILL.md %s\n' "$UP_FILES"
} > "$DEST/UPSTREAM.txt"

# Strip the upstream version frontmatter (unsupported here; plugin.json versions instead).
perl -ni -e 'print unless !$d && /^version:/ && ($d=1)' "$DEST/SKILL.md"

perl -pi -e 'BEGIN{$d=shift} $_="$d\n" if /^description:/' 'description: Drive the Tabular Editor CLI (`te`) to scaffold, inspect, edit, validate, run BPA on, query, deploy, refresh and test a semantic model from a terminal or CI. Use when running a `te` command, validating or deploying TMDL, BIM or PBIP models, writing DAX regression tests, or migrating a TabularEditor.exe (TE2) pipeline with `te util migrate`.' "$DEST/SKILL.md"
perl -pi -e 's{`--save` here names the snapshot file to write and has nothing to do with the mutation flag on editing commands\.}{`-o, --output-file` names the snapshot file to write; `--save` is rejected here.}' "$DEST/references/testing.md"
find "$DEST" -name '*.md' -exec perl -pi -e 's{cdn\.tabulareditor\.com/files/cli/latest/}{cdn.tabulareditor.com/files/latest/cli/}g' {} +

# Re-apply the local-only augmentations (upstream does not carry these).
write_get_ref
inject_pointer
inject_local_sections
for marker in 'references/get-te-cli.md' '## Bundled scripts' 'manage-ai-metadata.csx' '`references/dax-test-patterns.md`'; do
  grep -qF "$marker" "$DEST/SKILL.md" || printf 'sync-te-cli: WARNING local section "%s" did not land; upstream changed the anchor it hooks onto\n' "$marker" >&2
done

if git -C "$REPO_ROOT" diff --quiet -- plugins/tabular-editor/skills/te-cli 2>/dev/null; then
  printf 'sync-te-cli: up to date with upstream\n'
else
  printf 'sync-te-cli: te-cli skill updated from upstream; review and commit:\n'
  git -C "$REPO_ROOT" --no-pager diff --stat -- plugins/tabular-editor/skills/te-cli
fi
exit 0
