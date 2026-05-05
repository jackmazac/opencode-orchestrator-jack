#!/usr/bin/env bash
# Install a git pre-commit hook in this repo and in each developed plugin.
#
# The hook runs `bun run lint:no-zod && bun run typecheck` (when those scripts
# exist in package.json) before allowing the commit. For ~/.config/opencode/,
# it runs `bun run check` when fleet.jsonc, opencode.json, or plugin overrides are staged.
#
# Idempotent: re-runs replace the hook with the latest version.
#
# Usage: bash ~/.config/opencode/scripts/install-precommit.sh

set -euo pipefail

REPOS=(
  "/Users/jack.mazac/.config/opencode"
  "/Users/jack.mazac/Developer/engram"
  "/Users/jack.mazac/Developer/opencode-conductor"
  "/Users/jack.mazac/Developer/codemem"
  "/Users/jack.mazac/Developer/opencode-host-adapter"
)

# Hook payload — generic; the hook itself decides which checks apply per repo.
HOOK_BODY='#!/usr/bin/env bash
# Installed by ~/.config/opencode/scripts/install-precommit.sh
# Runs lint:no-zod, typecheck, and (for ~/.config/opencode/) fleet check when
# manifest or generated config is staged.

set -e

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Skip when running inside a rebase / merge / cherry-pick.
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -f .git/MERGE_HEAD ] || [ -f .git/CHERRY_PICK_HEAD ]; then
  exit 0
fi

run_if_script_exists() {
  local script="$1"
  if [ ! -f package.json ]; then return; fi
  if ! grep -q "\"$script\"" package.json; then return; fi
  echo "[pre-commit] $repo_root: bun run $script"
  bun run "$script"
}

# Always run lint:no-zod when staged files include plugin boundary files (.ts in src/).
if git diff --cached --name-only | grep -qE "(^src/.*\.ts$|^packages/codemem-plugin/src/.*\.ts$)"; then
  run_if_script_exists "lint:no-zod"
fi

# Run typecheck when any .ts is staged.
if git diff --cached --name-only | grep -qE "\.ts$"; then
  run_if_script_exists "typecheck"
fi

# In ~/.config/opencode/, run fleet doctor + test when manifest or generated config is staged.
if [ "$repo_root" = "/Users/jack.mazac/.config/opencode" ]; then
  if git diff --cached --name-only | grep -qE "(^opencode\.json$|^fleet\.jsonc$|^plugin/.*\.ts$)"; then
    echo "[pre-commit] $repo_root: bun run check"
    bun run check
  fi
fi
'

installed=0
for repo in "${REPOS[@]}"; do
  if [ ! -d "$repo/.git" ]; then
    echo "skip: $repo (not a git repo)"
    continue
  fi
  hook_path="$repo/.git/hooks/pre-commit"
  printf "%s" "$HOOK_BODY" > "$hook_path"
  chmod +x "$hook_path"
  echo "ok:   $hook_path"
  installed=$((installed+1))
done

echo ""
echo "installed pre-commit hook in $installed repo(s)."
echo ""
echo "to bypass for an emergency commit:"
echo "  git commit --no-verify -m '...'"
echo ""
echo "to remove later:"
echo "  rm <repo>/.git/hooks/pre-commit"
