#!/bin/bash
#
# PostToolUse hook: validate PBIR structure in .Report/ files
#
# Handles Write, Edit, and Bash tool use. Extracts file paths and validates:
#   1. JSON syntax (jq empty)
#   2. Folder name spaces (pages/visuals won't render)
#   3. Required fields per file type (from Microsoft JSON schemas)
#   4. $schema URL format
#   5. Visual/page name format (word chars and hyphens only)
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


# ── Validate a single file ──────────────────────────────────────────────────
# Returns 0 on pass, 2 on blocking error (message already written to stderr).

validate_file() {
    local FILE_PATH="$1"

    # Normalize path separators
    FILE_PATH="${FILE_PATH//\\//}"

    # Must be a JSON or PBIR file
    case "$FILE_PATH" in
        *.json|*.pbir) ;;
        *) return 0 ;;
    esac

    # Must be inside a .Report/ directory
    [[ ! "$FILE_PATH" =~ \.Report/ ]] && return 0

    # File must exist
    [[ -f "$FILE_PATH" ]] || return 0

    # ── JSON syntax ─────────────────────────────────────────────────────
    if check_enabled json_syntax && ! ERROR=$(jq empty "$FILE_PATH" 2>&1); then
        echo "JSON validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "$ERROR" >&2
        echo "" >&2
        echo "Fix the JSON syntax error before continuing." >&2
        echo "" >&2
        echo "$SKILL_TIP" >&2
        return 2
    fi

    # Remaining checks only apply to .Report/ files
    [[ ! "$FILE_PATH" =~ \.Report/ ]] && return 0

    local BASENAME
    BASENAME=$(basename "$FILE_PATH")

    # ── Folder name spaces ──────────────────────────────────────────────
    local REPORT_RELATIVE="${FILE_PATH#*\.Report/}"
    local DIR_PATH
    DIR_PATH=$(dirname "$REPORT_RELATIVE")
    if check_enabled folder_spaces && [[ "$DIR_PATH" =~ \  ]]; then
        echo "PBIR validation failed: $FILE_PATH" >&2
        echo "" >&2
        echo "Folder path contains spaces: $DIR_PATH" >&2
        echo "Pages and visuals with spaces in folder names deploy but won't render in Power BI." >&2
        echo "Rename folders to use underscores or hyphens instead of spaces." >&2
        echo "" >&2
        echo "$SKILL_TIP" >&2
        return 2
    fi

    # ── Per-file-type validation ────────────────────────────────────────
    local RESULT VALS SCHEMA MISSING

    case "$BASENAME" in
        visual.json)
            RESULT=$(jq -r '
                (."$schema" // ""),
                (has("name") | tostring),
                (has("position") | tostring),
                (has("visual") | tostring),
                (has("visualGroup") | tostring),
                (.name // "")
            ' "$FILE_PATH" 2>/dev/null) || return 0

            VALS=()
            while IFS= read -r line; do VALS+=("$line"); done <<< "$RESULT"
            SCHEMA="${VALS[0]:-}"
            local HAS_NAME="${VALS[1]:-}" HAS_POSITION="${VALS[2]:-}"
            local HAS_VISUAL="${VALS[3]:-}" HAS_VISUAL_GROUP="${VALS[4]:-}"
            local NAME="${VALS[5]:-}"

            if check_enabled required_fields; then
                MISSING=()
                [[ -z "$SCHEMA" ]] && MISSING+=("\$schema")
                [[ "$HAS_NAME" != "true" ]] && MISSING+=("name")
                [[ "$HAS_POSITION" != "true" ]] && MISSING+=("position")
                if [[ "$HAS_VISUAL" != "true" ]] && [[ "$HAS_VISUAL_GROUP" != "true" ]]; then
                    MISSING+=("visual or visualGroup (oneOf)")
                fi
                if [[ ${#MISSING[@]} -gt 0 ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Missing required fields: ${MISSING[*]}" >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled schema_url && [[ -n "$SCHEMA" ]]; then
                if [[ ! "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definition/ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Unexpected \$schema URL: $SCHEMA" >&2
                    echo "Expected: https://developer.microsoft.com/json-schemas/fabric/item/report/definition/..." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled name_format && [[ -n "$NAME" ]]; then
                if [[ ! "$NAME" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_-]*$ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Invalid name: '$NAME'" >&2
                    echo "Names must consist of word characters (letters, digits, underscores) or hyphens." >&2
                    echo "Non-compliant names cause Power BI to silently ignore the object." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi
            ;;

        page.json)
            RESULT=$(jq -r '
                (."$schema" // ""),
                (has("name") | tostring),
                (has("displayName") | tostring),
                (has("displayOption") | tostring),
                (.name // "")
            ' "$FILE_PATH" 2>/dev/null) || return 0

            VALS=()
            while IFS= read -r line; do VALS+=("$line"); done <<< "$RESULT"
            SCHEMA="${VALS[0]:-}"
            local HAS_NAME="${VALS[1]:-}" HAS_DISPLAY_NAME="${VALS[2]:-}"
            local HAS_DISPLAY_OPTION="${VALS[3]:-}" NAME="${VALS[4]:-}"

            if check_enabled required_fields; then
                MISSING=()
                [[ -z "$SCHEMA" ]] && MISSING+=("\$schema")
                [[ "$HAS_NAME" != "true" ]] && MISSING+=("name")
                [[ "$HAS_DISPLAY_NAME" != "true" ]] && MISSING+=("displayName")
                [[ "$HAS_DISPLAY_OPTION" != "true" ]] && MISSING+=("displayOption")
                if [[ ${#MISSING[@]} -gt 0 ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Missing required fields: ${MISSING[*]}" >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled schema_url && [[ -n "$SCHEMA" ]]; then
                if [[ ! "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definition/ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Unexpected \$schema URL: $SCHEMA" >&2
                    echo "Expected: https://developer.microsoft.com/json-schemas/fabric/item/report/definition/..." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled name_format && [[ -n "$NAME" ]]; then
                if [[ ! "$NAME" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_-]*$ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Invalid name: '$NAME'" >&2
                    echo "Names must consist of word characters (letters, digits, underscores) or hyphens." >&2
                    echo "Non-compliant names cause Power BI to silently ignore the object." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi
            ;;

        report.json)
            RESULT=$(jq -r '
                (."$schema" // ""),
                (has("themeCollection") | tostring)
            ' "$FILE_PATH" 2>/dev/null) || return 0

            VALS=()
            while IFS= read -r line; do VALS+=("$line"); done <<< "$RESULT"
            SCHEMA="${VALS[0]:-}"
            local HAS_THEME="${VALS[1]:-}"

            if check_enabled required_fields; then
                MISSING=()
                [[ -z "$SCHEMA" ]] && MISSING+=("\$schema")
                [[ "$HAS_THEME" != "true" ]] && MISSING+=("themeCollection")
                if [[ ${#MISSING[@]} -gt 0 ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Missing required fields: ${MISSING[*]}" >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled schema_url && [[ -n "$SCHEMA" ]]; then
                if [[ ! "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definition/ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Unexpected \$schema URL: $SCHEMA" >&2
                    echo "Expected: https://developer.microsoft.com/json-schemas/fabric/item/report/definition/..." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi
            ;;

        definition.pbir)
            # Schema: definitionProperties/2.0.0
            # Required: $schema, version, datasetReference
            # Note: definition.pbir uses a different $schema URL base path (definitionProperties/)
            RESULT=$(jq -r '
                (."$schema" // ""),
                (has("version") | tostring),
                (has("datasetReference") | tostring)
            ' "$FILE_PATH" 2>/dev/null) || return 0

            VALS=()
            while IFS= read -r line; do VALS+=("$line"); done <<< "$RESULT"
            SCHEMA="${VALS[0]:-}"
            local HAS_VERSION="${VALS[1]:-}" HAS_DATASET_REF="${VALS[2]:-}"

            if check_enabled required_fields; then
                MISSING=()
                [[ -z "$SCHEMA" ]] && MISSING+=("\$schema")
                [[ "$HAS_VERSION" != "true" ]] && MISSING+=("version")
                [[ "$HAS_DATASET_REF" != "true" ]] && MISSING+=("datasetReference")
                if [[ ${#MISSING[@]} -gt 0 ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Missing required fields: ${MISSING[*]}" >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi

            if check_enabled schema_url && [[ -n "$SCHEMA" ]]; then
                if [[ ! "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definitionProperties/2\.[0-9]+\.[0-9]+/schema\.json$ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Unexpected \$schema URL: $SCHEMA" >&2
                    echo "Expected pattern: https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.x.x/schema.json" >&2
                    echo "Note: definition.pbir uses a different schema path (definitionProperties/) than other PBIR files." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi
            ;;

        reportExtensions.json|*.bookmark.json)
            if check_enabled schema_url; then
                SCHEMA=$(jq -r '."$schema" // empty' "$FILE_PATH" 2>/dev/null)
                if [[ -n "$SCHEMA" ]] && [[ ! "$SCHEMA" =~ ^https://developer\.microsoft\.com/json-schemas/fabric/item/report/definition/ ]]; then
                    echo "PBIR validation failed: $FILE_PATH" >&2
                    echo "" >&2
                    echo "Unexpected \$schema URL: $SCHEMA" >&2
                    echo "Expected: https://developer.microsoft.com/json-schemas/fabric/item/report/definition/..." >&2
                    echo "" >&2
                    echo "$SKILL_TIP" >&2
                    return 2
                fi
            fi
            ;;
    esac

    return 0
}


# ── Extract file paths from tool input ──────────────────────────────────────

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    [[ -z "$FILE_PATH" ]] && exit 0
    validate_file "$FILE_PATH"
    exit $?

elif [[ "$TOOL_NAME" == "Bash" ]]; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
    [[ -z "$COMMAND" ]] && exit 0

    # Extract candidate file paths ending in .json or .pbir
    CANDIDATES=()
    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE '[^ "'\''><|;]+\.(json|pbir)[^ "'\''><|;]*' 2>/dev/null)

    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE '"[^"]+\.(json|pbir)"' 2>/dev/null | tr -d '"')

    while IFS= read -r path; do
        [[ -n "$path" ]] && CANDIDATES+=("$path")
    done < <(echo "$COMMAND" | grep -oE "'[^']+\.(json|pbir)'" 2>/dev/null | tr -d "'")

    [[ ${#CANDIDATES[@]} -eq 0 ]] && exit 0

    # Deduplicate
    DEDUPED=()
    while IFS= read -r path; do
        [[ -n "$path" ]] && DEDUPED+=("$path")
    done < <(printf '%s\n' "${CANDIDATES[@]}" | sort -u)

    # Validate each file; collect errors
    ERRORS=()
    for CANDIDATE in "${DEDUPED[@]}"; do
        if ! validate_file "$CANDIDATE" 2>/tmp/pbir_hook_err_$$; then
            ERRORS+=("$(cat /tmp/pbir_hook_err_$$ 2>/dev/null)")
        fi
        rm -f /tmp/pbir_hook_err_$$
    done

    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        for err in "${ERRORS[@]}"; do
            echo "$err" >&2
        done
        exit 2
    fi
fi

exit 0
