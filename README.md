# OpenCode fleet config

Machine-local **runtime config** for OpenCode: editable **`fleet.jsonc`** (manifest), generated **`opencode.json`**, and Fleet CLI wrappers. **Do not hand-edit** `opencode.json`—regenerate from the manifest.

## Quick start

```bash
cd ~/.config/opencode
bun install
bun run fleet:doctor -- --json
bun run fleet:test -- --json
```

## Regenerate plugins into `opencode.json`

Edit `fleet.jsonc`, then (paths may vary on your machine):

```bash
bun run /path/to/opencode-fleet/src/cli.ts generate-opencode-json --force
bun run /path/to/opencode-fleet/src/cli.ts install
bun run fleet:test:full-runtime
```

Commit **`fleet.jsonc`**, **`opencode.json`**, **`.opencode-fleet.lock.json`**, **`package.json`**, and **`bun.lock`** together when the manifest changes.

## Layout (short)

| Path | Role |
|------|------|
| `fleet.jsonc` | Source of truth for enabled plugins and `expected_tools` |
| `opencode.json` | Generated + user sections (agents, MCP, etc.) |
| `.opencode-fleet.lock.json` | Manifest hash / drift |
| `dcp.jsonc`, `dcp-prompts/` | Dynamic context pruning |
| `command/` | User commands |
| `plugin/` | Overrides only—not product logic |

**No** project session state here: per-worktree `.opencode/` lives in each repo per **`AGENTS.md`**.

## Scripts

`fleet:doctor`, `fleet:test`, `fleet:hygiene`, `check`—see **`package.json`**. Full rules: **`AGENTS.md`**.

## License

Config files are yours; plugin packages follow their respective licenses.
