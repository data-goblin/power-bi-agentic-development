#!/usr/bin/env bash
# Upgrade package managers to versions that support minimum release age,
# then configure a 7-day cooldown on each.
set -euo pipefail

DAYS=7

# ── uv ────────────────────────────────────────────────────────────────────────
if command -v uv &>/dev/null; then
  uv self update
  UV_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/uv/uv.toml"
  mkdir -p "$(dirname "$UV_CFG")"
  if grep -q 'exclude-newer' "$UV_CFG" 2>/dev/null; then
    sed -i.bak "s|^exclude-newer.*|exclude-newer = \"$DAYS days\"|" "$UV_CFG" && rm -f "$UV_CFG.bak"
  else
    printf '\nexclude-newer = "%s days"\n' "$DAYS" >> "$UV_CFG"
  fi
  echo "uv: exclude-newer = $DAYS days"
fi

# ── bun ───────────────────────────────────────────────────────────────────────
if command -v bun &>/dev/null; then
  bun upgrade
  BUNFIG="$HOME/.bunfig.toml"
  SECS=$(( DAYS * 86400 ))
  if grep -q 'minimumReleaseAge' "$BUNFIG" 2>/dev/null; then
    sed -i.bak "s|^minimumReleaseAge.*|minimumReleaseAge = $SECS|" "$BUNFIG" && rm -f "$BUNFIG.bak"
  else
    printf '\n[install]\nminimumReleaseAge = %s\n' "$SECS" >> "$BUNFIG"
  fi
  echo "bun: minimumReleaseAge = $SECS"
fi

# ── pnpm ──────────────────────────────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  pnpm self-update 2>/dev/null || true
  pnpm config set minimumReleaseAge "$DAYS days"
  echo "pnpm: minimumReleaseAge = $DAYS days"
fi

# ── npm ───────────────────────────────────────────────────────────────────────
# Requires npm >= 11.10.0. Upgrade node via nvm before running this if needed.
if command -v npm &>/dev/null; then
  NPMRC="$HOME/.npmrc"
  if grep -q 'min-release-age' "$NPMRC" 2>/dev/null; then
    sed -i.bak "s|^min-release-age.*|min-release-age=${DAYS}d|" "$NPMRC" && rm -f "$NPMRC.bak"
  else
    printf 'min-release-age=%sd\n' "$DAYS" >> "$NPMRC"
  fi
  echo "npm: min-release-age = ${DAYS}d"
fi

# ── pip ───────────────────────────────────────────────────────────────────────
# Requires pip >= 26.1. Upgrade with: python3 -m pip install --upgrade pip
if command -v python3 &>/dev/null; then
  PIP_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/pip/pip.conf"
  mkdir -p "$(dirname "$PIP_CFG")"
  if grep -q 'uploaded-prior-to' "$PIP_CFG" 2>/dev/null; then
    sed -i.bak "s|^uploaded-prior-to.*|uploaded-prior-to = P${DAYS}D|" "$PIP_CFG" && rm -f "$PIP_CFG.bak"
  else
    if ! grep -q '^\[install\]' "$PIP_CFG" 2>/dev/null; then
      printf '[install]\n' >> "$PIP_CFG"
    fi
    printf 'uploaded-prior-to = P%sD\n' "$DAYS" >> "$PIP_CFG"
  fi
  echo "pip: uploaded-prior-to = P${DAYS}D"
fi

# ── cargo ─────────────────────────────────────────────────────────────────────
# No native config.toml support as of 1.95. Rustup update only.
if command -v rustup &>/dev/null; then
  rustup update stable
  echo "cargo: updated (no native release-age config in stable)"
fi

echo ""
echo "Done. 7-day cooldown active on: uv, bun, pnpm, npm, pip"
