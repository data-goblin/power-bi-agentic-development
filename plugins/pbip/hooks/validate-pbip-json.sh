#!/bin/bash
#
# PostToolUse hook: validate JSON syntax in PBIP project files
#
# Runs jq empty on any .json or .pbir file inside a PBIP project directory
# (.Report/, .SemanticModel/, .Dataset/). Blocks on invalid JSON (exit 2).
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

# Must be a JSON or PBIR file
case "$FILE_PATH" in
    *.json|*.pbir) ;;
    *) exit 0 ;;
esac

# Must be inside a PBIP project directory
if [[ ! "$FILE_PATH" =~ \.Report/ ]] && \
   [[ ! "$FILE_PATH" =~ \.SemanticModel/ ]] && \
   [[ ! "$FILE_PATH" =~ \.Dataset/ ]]; then
    exit 0
fi

# File must exist (Write creates it; Edit modifies it)
[[ -f "$FILE_PATH" ]] || exit 0

# Validate JSON syntax
if ! ERROR=$(jq empty "$FILE_PATH" 2>&1); then
    echo "JSON validation failed: $FILE_PATH" >&2
    echo "" >&2
    echo "$ERROR" >&2
    echo "" >&2
    echo "Fix the JSON syntax error before continuing." >&2
    exit 2
fi

exit 0
