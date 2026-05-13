# Runbook: opencode plugin broken / undefined zod / OCX errors

When opencode launches with a `TypeError: undefined is not an object (evaluating 'n._zod.def')`, a plugin load failure, or any other plugin-related error, follow this in order. Each step is non-destructive — quarantine before delete.

## Step 1 — Capture the failure

```bash
cd ~/.config/opencode
opencode debug config --print-logs 2>&1 | grep -E "ERROR|n\._zod" | head -20
```

If errors only appear in real chat sessions (not `debug config`), capture a full session log:

```bash
mkdir -p ~/.config/opencode/.opencode/snapshots
opencode --log-level DEBUG --print-logs 2>&1 | tee ~/.config/opencode/.opencode/snapshots/repro-$(date -u +%Y%m%dT%H%M%SZ).log
```

Note exactly which UI text or tool was active when the error occurred.

## Step 2 — Run preflight

```bash
bun run ~/.config/opencode/scripts/preflight.ts
```

A red `[fail]` line names the broken plugin and the specific check that failed. Most categories of breakage are caught here:

- Missing plugin source.
- Stale `opencode-conductor@latest` cache (NocturnLabs' v1.0.6, not yours).
- Codemem-style `args: z.object({...})` bug.
- Worktree state DB orphan OCX rows.
- Engram sidecar corruption.
- Tool name collisions across plugins.

If preflight passes but you still see runtime errors, continue to step 3.

## Step 3 — Clean the cache

```bash
bash ~/.config/opencode/scripts/clean-cache.sh
```

This quarantines the npm-resolved copies of locally-developed plugins. After running, restart opencode. The local `file://` refs in `opencode.json` will be authoritative.

## Step 4 — Rollback opencode.json

If preflight + cache clean don't help, restore the last known-good config:

```bash
ls -lt ~/.config/opencode/.opencode/snapshots/opencode.json.known-good-* | head -1
# Compare current to the known-good
diff ~/.config/opencode/opencode.json $(ls -t ~/.config/opencode/.opencode/snapshots/opencode.json.known-good-* | head -1)
# Restore manually if needed (do NOT just clobber — review the diff first)
```

## Step 5 — Bisect plugins

Comment out plugins one at a time in `~/.config/opencode/opencode.json`'s `"plugin"` array, restart opencode after each, and observe whether the error reproduces. The plugin you commented out when the error disappeared is the culprit.

For a no-plugin baseline:

```bash
opencode --pure
```

If the error reproduces in `--pure` mode, the issue is in opencode itself, not a plugin.

## Step 6 — Inspect the lifecycle dashboard

```bash
cd /Users/jack.mazac/Developer/engram
bun run ./src/cli/run.ts dashboard --plugins
```

Per-plugin shows: load count, recent failures, hook kinds, tool counts, validation failures, hook failures.

For machine-readable output:

```bash
bun run ./src/cli/run.ts dashboard --plugins --json | jq '.perPlugin[] | select(.recentFailures | length > 0)'
```

## Step 7 — Audit zod versions

If the error is the classic `n._zod.def` undefined, audit zod copies in the broken plugin's tree:

```bash
cd /Users/jack.mazac/Developer/<plugin-repo>
bun run /Users/jack.mazac/Developer/opencode-host-adapter/src/cli/audit-zod.ts ./node_modules
```

Multiple resolved versions = potential brand-symbol mismatch; pin via lockfile.

## Step 8 — Re-enable plugins one at a time

After fixing the root cause, re-enable plugins in `opencode.json` one at a time:

1. Restart opencode after each addition.
2. Run preflight.
3. Run a minimal smoke chat.
4. Check the lifecycle dashboard for new failures.

## Step 9 — Write a regression test

In the offending plugin's `test/contract.test.ts`, add a test that would have caught the bug. Run it with:

```bash
cd /Users/jack.mazac/Developer/<plugin-repo>
bun test
```

## Common root causes (recently seen)

| Symptom | Cause | Fix |
|---|---|---|
| `n._zod.def` undefined during chat | Plugin uses `args: z.object({...})` instead of `args: { ... }` | Change to ZodRawShape literal; preflight catches this |
| `Configured OCX binary "undefined"` at load | Worktree plugin's named exports are probed by opencode loader | Un-export internal helpers; only export the Plugin |
| `ENOENT: no such file or directory ... @codemem/package.json` | Codemem not published to npm; opencode looks in cache | Use `file://` ref to local install in opencode.json |
| Conductor tools differ from your dev tree | npm `opencode-conductor` is NocturnLabs' package, not yours | Rename to `@mazac-fox/opencode-conductor`; quarantine cache |

## What NOT to do

- Do not blindly `npm install --force` everything; that masks the actual cause.
- Do not edit cached files at `~/.cache/opencode/packages/...`; they get overwritten on next opencode launch.
- Do not delete `~/.config/opencode/node_modules/` without a backup; some plugins (like `@codemem/plugin`) only live there.
- Do not commit `opencode.json` changes that disable plugins as a "fix"; document the root cause first.
