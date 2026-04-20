#!/bin/bash
#
# PostToolUse hook: validate report-to-model binding in definition.pbir
#
# Handles Write, Edit, and Bash tool use. Validates that definition.pbir
# has a valid semantic model connection:
#   - datasetReference must have byPath or byConnection (non-null)
#   - byPath: path field required; target directory must exist locally
#   - byConnection: connectionString required; model verified via fab exists
#
# Schema validation ($schema, version, required fields) is handled by
# validate-pbir.sh; this hook focuses only on the binding.
#
# Checks can be toggled via config.yaml in the same directory as this script.
#
# Exit codes:
#   0 - OK or not applicable
#   2 - Blocking: validation error detected
#

set -uo pipefail

INPUT=$(cat)

# Skip if jq not available
command -v jq &>/dev/null || exit 0

# ── Config ──────────────────────────────────────────────────────────────────
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
HOOK_CONFIG="$HOOK_DIR/config.yaml"

check_enabled() {
    local check_name="$1"
    [[ -f "$HOOK_CONFIG" ]] || return 0
    grep -qE "^${check_name}:\\s*false" "$HOOK_CONFIG" 2>/dev/null && return 1
    return 0
}

SKILL_TIP="Tip: use the pbir-format skill if you are modifying PBIR files directly. Use the pbir-cli skill if you are using the pbir CLI."

# ── Extract file path from tool input ───────────────────────────────────────

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=""

if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
elif [[ "$TOOL_NAME" == "Bash" ]]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
    [[ -z "$COMMAND" ]] && exit 0
    FILE_PATH=$(echo "$COMMAND" | grep -oE '"[^"]*definition\.pbir"' 2>/dev/null | tr -d '"' | head -1)
    [[ -z "$FILE_PATH" ]] && FILE_PATH=$(echo "$COMMAND" | grep -oE "'[^']*definition\.pbir'" 2>/dev/null | tr -d "'" | head -1)
    [[ -z "$FILE_PATH" ]] && FILE_PATH=$(echo "$COMMAND" | grep -oE '[^ "'\''><|;]*definition\.pbir[^ "'\''><|;]*' 2>/dev/null | head -1)
else
    exit 0
fi

# Normalize path separators
FILE_PATH="${FILE_PATH//\\//}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ "$(basename "$FILE_PATH")" != "definition.pbir" ]] && exit 0
[[ ! "$FILE_PATH" =~ \.Report/ ]] && exit 0
[[ -f "$FILE_PATH" ]] || exit 0


# ── Extract binding fields in a single jq call ─────────────────────────────

RESULT=$(jq -r '
    (.datasetReference.byPath // null | type),
    (.datasetReference.byPath.path // ""),
    (.datasetReference.byConnection // null | type),
    (.datasetReference.byConnection.connectionString // "")
' "$FILE_PATH" 2>/dev/null) || exit 0

VALS=()
while IFS= read -r line; do VALS+=("$line"); done <<< "$RESULT"
BYPATH_TYPE="${VALS[0]:-}"
BYPATH_PATH="${VALS[1]:-}"
BYCONN_TYPE="${VALS[2]:-}"
BYCONN_CONNSTR="${VALS[3]:-}"

HAS_BYPATH="false"
HAS_BYCONN="false"
[[ "$BYPATH_TYPE" == "object" ]] && HAS_BYPATH="true"
[[ "$BYCONN_TYPE" == "object" ]] && HAS_BYCONN="true"


# ── Must have at least one binding ──────────────────────────────────────────

if [[ "$HAS_BYPATH" != "true" ]] && [[ "$HAS_BYCONN" != "true" ]]; then
    echo "PBIR validation failed: $FILE_PATH" >&2
    echo "" >&2
    echo "datasetReference must contain either byPath or byConnection." >&2
    echo "Neither is present (or both are null)." >&2
    echo "" >&2
    echo "$SKILL_TIP" >&2
    exit 2
fi


# ── byPath: validate path field and target directory ────────────────────────

if [[ "$HAS_BYPATH" == "true" ]]; then
    if [[ -z "$BYPATH_PATH" ]]; then
        echo "PBIR validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "datasetReference.byPath.path is required but empty or missing." >&2
        echo "" >&2
        echo "$SKILL_TIP" >&2
        exit 2
    fi

    if check_enabled bypath_exists; then
        PBIR_DIR=$(dirname "$FILE_PATH")
        RESOLVED=$(cd "$PBIR_DIR" 2>/dev/null && cd "$(dirname "$BYPATH_PATH")" 2>/dev/null && echo "$PWD/$(basename "$BYPATH_PATH")" 2>/dev/null) || RESOLVED=""

        if [[ -n "$RESOLVED" ]] && [[ ! -d "$RESOLVED" ]]; then
            echo "PBIR validation failed: $FILE_PATH" >&2
            echo "" >&2
            echo "byPath references: $BYPATH_PATH" >&2
            echo "Resolved to: $RESOLVED" >&2
            echo "Directory does not exist. Ensure the semantic model directory is present." >&2
            echo "" >&2
            echo "$SKILL_TIP" >&2
            exit 2
        fi
    fi
fi


# ── byConnection: validate connectionString + fab exists ───────────────────

if [[ "$HAS_BYCONN" == "true" ]]; then
    if [[ -z "$BYCONN_CONNSTR" ]]; then
        echo "PBIR validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "datasetReference.byConnection.connectionString is required but empty or missing." >&2
        echo "" >&2
        echo "$SKILL_TIP" >&2
        exit 2
    fi

    if check_enabled fab_exists && command -v fab &>/dev/null; then
        WORKSPACE=""
        MODEL=""

        if [[ "$BYCONN_CONNSTR" =~ myorg/\"([^\"]*)\" ]]; then
            WORKSPACE="${BASH_REMATCH[1]}"
        elif [[ "$BYCONN_CONNSTR" =~ myorg/([^\"\;]*) ]]; then
            WORKSPACE="${BASH_REMATCH[1]}"
        fi

        if [[ "$BYCONN_CONNSTR" =~ initial\ catalog=\"([^\"]*)\" ]]; then
            MODEL="${BASH_REMATCH[1]}"
        elif [[ "$BYCONN_CONNSTR" =~ initial\ catalog=([^\;]*) ]]; then
            MODEL="${BASH_REMATCH[1]}"
        fi

        if [[ -n "$WORKSPACE" ]] && [[ -n "$MODEL" ]]; then
            FAB_PATH="$WORKSPACE.Workspace/$MODEL.SemanticModel"
            FAB_RESULT=$(fab exists "$FAB_PATH" 2>/dev/null) || FAB_RESULT=""

            if [[ "$FAB_RESULT" == *"false"* ]]; then
                echo "PBIR validation failed: $FILE_PATH" >&2
                echo "" >&2
                echo "This semantic model does not exist, or the user logged in to fab does not have access to it." >&2
                echo "  Workspace: $WORKSPACE" >&2
                echo "  Model: $MODEL" >&2
                echo "" >&2
                echo "Check: fab auth status" >&2
                echo "Check: fab ls \"$WORKSPACE.Workspace/$MODEL.SemanticModel\"" >&2
                echo "" >&2
                echo "$SKILL_TIP" >&2
                exit 2
            fi
        fi
    fi
fi

exit 0
