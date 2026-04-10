#!/bin/bash
#
# Thin wrapper that locates and runs the pbi-hooks binary with the given subcommand.
# Checks bundled bin/ first, then tools/ dev build, then PATH.
#
# Usage: run-pbi-hooks.sh <subcommand>
#   Subcommands: validate-dax, validate-measure, refresh-cache, check-ri, check-compat

SUBCOMMAND="${1:-}"
if [[ -z "$SUBCOMMAND" ]]; then
    exit 0
fi

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# Detect platform suffix
detect_suffix() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Darwin)
            case "$arch" in
                arm64) echo "darwin-arm64" ;;
                *)     echo "darwin-x64" ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            echo "windows-x64"
            ;;
        *)
            echo ""
            ;;
    esac
}

SUFFIX="$(detect_suffix)"
BINARY=""

# 0. Prefer script (no unsigned binary needed; requires jq)
SCRIPT="$HOOK_DIR/pbi-hooks.sh"
if [[ -x "$SCRIPT" ]] && command -v jq &>/dev/null; then
    export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$HOOK_DIR")}"
    exec bash "$SCRIPT" "$SUBCOMMAND"
fi

# 1. Bundled binary in hooks/bin/
if [[ -n "$SUFFIX" ]]; then
    for EXT in "" ".exe"; do
        CANDIDATE="$HOOK_DIR/bin/pbi-hooks-${SUFFIX}${EXT}"
        if [[ -x "$CANDIDATE" ]]; then
            BINARY="$CANDIDATE"
            break
        fi
    done
fi

# 2. Dev build in tools/
if [[ -z "$BINARY" && -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    for EXT in "" ".exe"; do
        CANDIDATE="${CLAUDE_PROJECT_DIR//\\//}/tools/pbi-hooks/target/release/pbi-hooks${EXT}"
        if [[ -x "$CANDIDATE" ]]; then
            BINARY="$CANDIDATE"
            break
        fi
    done
fi

# 3. PATH
if [[ -z "$BINARY" ]]; then
    command -v pbi-hooks &>/dev/null && BINARY="pbi-hooks"
fi

# Skip silently if not found
if [[ -z "$BINARY" ]]; then
    exit 0
fi

# Pass hook directory so binary can find config.yaml and .ps1 scripts
# Same pattern as pbip hooks: derive from script's own location, not CLAUDE_PLUGIN_ROOT
export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$HOOK_DIR")}"

exec "$BINARY" "$SUBCOMMAND"
