#!/usr/bin/env bash
#
# Validate all plugin manifests and the marketplace manifest.
# Runs locally or in CI; requires `claude` CLI on PATH.
#
# Usage:
#   bash scripts/validate-plugins.sh
#
set -euo pipefail

if ! command -v claude &>/dev/null; then
  echo "ERROR: claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi


# #region Marketplace
echo "=== Marketplace manifest ==="
claude plugin validate .
echo ""
# #endregion


# #region Plugins
exit_code=0
for dir in plugins/*/; do
  # Skip gitignored plugins
  if git check-ignore -q "$dir" 2>/dev/null; then
    echo "Skipping (gitignored): $dir"
    continue
  fi

  echo "--- $dir ---"
  if ! claude plugin validate "$dir"; then
    exit_code=1
  fi
  echo ""
done
# #endregion


if [ $exit_code -eq 0 ]; then
  echo "All plugins passed validation."
else
  echo "Some plugins failed validation."
fi
exit $exit_code
