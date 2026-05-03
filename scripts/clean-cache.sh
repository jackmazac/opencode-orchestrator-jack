#!/usr/bin/env bash
# Quarantine opencode's package cache for locally-developed plugins.
#
# Run after every opencode binary upgrade or after renaming a local plugin's
# package name. opencode's auto-fetch can pull a stale copy (or worse, a
# stranger's package with the same name) into its cache and resolve from
# there instead of the local file:// install.
#
# Quarantine (instead of delete) so we can recover if something breaks.
#
# Usage:
#   bash ~/.config/opencode/scripts/clean-cache.sh

set -euo pipefail

CACHE_ROOT="${HOME}/.cache/opencode/packages"
TS=$(date -u +%Y%m%dT%H%M%SZ)
QUAR_DIR="${HOME}/.cache/opencode/.quarantine-${TS}"

# Local plugins whose npm name conflicts with strangers (or doesn't exist on npm)
# and which therefore must NEVER come from the auto-fetched cache.
TARGETS=(
  "opencode-conductor@latest"      # name owned by NocturnLabs on npm
  "@codemem/plugin@latest"         # not published to npm
  "opencode-engram@latest"         # local dev tree at Developer/engram
)

mkdir -p "$QUAR_DIR"
moved=0

for target in "${TARGETS[@]}"; do
  src="${CACHE_ROOT}/${target}"
  if [ -d "$src" ]; then
    dest="${QUAR_DIR}/$(echo "$target" | tr '/' '_')"
    mv "$src" "$dest"
    echo "quarantined: $src → $dest"
    moved=$((moved+1))
  else
    echo "ok: $src not present"
  fi
done

if [ "$moved" -eq 0 ]; then
  rmdir "$QUAR_DIR" 2>/dev/null || true
  echo ""
  echo "no stale cache entries to quarantine."
else
  echo ""
  echo "${moved} entry(s) quarantined to ${QUAR_DIR}"
  echo "if everything still works after restarting opencode, you can delete that directory."
fi
