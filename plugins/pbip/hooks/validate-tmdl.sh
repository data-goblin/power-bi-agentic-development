#!/bin/bash
#
# PostToolUse hook: validate TMDL structural syntax after Write/Edit
#
# Runs tmdl-validate binary on any .tmdl file inside a .SemanticModel/
# or .Dataset/ directory. Currently WARN-ONLY (exit 0 with message).
#
# NOTE: This is a lightweight structural linter, not a full TMDL parser.
# It will be superseded by `te validate` when the Tabular Editor CLI ships.
# To make this hook blocking instead of warning, change `exit 0` to `exit 2`
# in the validation failure block at the bottom of this script.
#
# Requires: tmdl-validate binary in $CLAUDE_PROJECT_DIR/tools/tmdl-validate/target/release/
# or on PATH. Silently skips if binary not found.
#

set -uo pipefail

INPUT=$(cat)

# Skip if jq not available
command -v jq &>/dev/null || exit 0

# Extract tool name and file path
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Normalize path separators for Windows compatibility
FILE_PATH="${FILE_PATH//\\//}"

# Only validate Write and Edit
[[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]] && exit 0

# Must have a file path
[[ -z "$FILE_PATH" ]] && exit 0

# Must be a .tmdl file
[[ "$FILE_PATH" != *.tmdl ]] && exit 0

# Must be inside a semantic model directory
if [[ ! "$FILE_PATH" =~ \.SemanticModel/ ]] && \
   [[ ! "$FILE_PATH" =~ \.Dataset/ ]] && \
   [[ ! "$FILE_PATH" =~ /definition/ ]]; then
    exit 0
fi

# File must exist
[[ -f "$FILE_PATH" ]] || exit 0

# Find the tmdl-validate binary (check .exe for Windows)
VALIDATOR=""
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    for EXT in "" ".exe"; do
        CANDIDATE="${CLAUDE_PROJECT_DIR//\\//}/tools/tmdl-validate/target/release/tmdl-validate${EXT}"
        if [[ -x "$CANDIDATE" ]]; then
            VALIDATOR="$CANDIDATE"
            break
        fi
    done
fi
if [[ -z "$VALIDATOR" ]] && command -v tmdl-validate &>/dev/null; then
    VALIDATOR="tmdl-validate"
fi

# Skip silently if binary not available
[[ -z "$VALIDATOR" ]] && exit 0

# Run validation
if ! ERROR=$("$VALIDATOR" "$FILE_PATH" 2>&1); then
    echo "TMDL validation failed: $FILE_PATH" >&2
    echo "" >&2
    echo "$ERROR" >&2
    echo "" >&2
    echo "Fix the TMDL structural errors before continuing." >&2
    # NOTE: Change `exit 2` to `exit 0` to make this hook warn-only
    exit 2
fi

exit 0
