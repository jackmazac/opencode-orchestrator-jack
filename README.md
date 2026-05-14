# OpenCode fleet config

Machine-local **runtime config** for OpenCode: editable **`fleet.jsonc`** (manifest), generated **`opencode.json`**, and Fleet CLI wrappers. **Do not hand-edit** `opencode.json`—regenerate from the manifest.

## Quick start

```bash
cd ~/.config/opencode
bun install
bun run fleet:doctor -- --json
bun run fleet:test -- --json
```

## Manifest: npm consumers vs local dev

- **Registry-only (no `~/Developer` clones):** point Fleet at [`examples/fleet.npm.jsonc`](../../Developer/opencode-fleet/examples/fleet.npm.jsonc) in the **opencode-fleet** repo, or copy it to this directory as `fleet.jsonc`. Then `fleet install` + `generate-opencode-json --force` resolve plugins from npm into `node_modules` under this root.
- **Local development:** use **`file:`** sources (see **opencode-fleet** `examples/fleet.local.jsonc`) or keep absolute `file:` paths in **`package.json`** privately—do not commit `/Users/...` paths. Alternatively use **`fleet.npm.jsonc`** plus Bun **`overrides`** so `@mazac-fox/*` resolves to your working trees.

`plugin_ref` paths in a consumer manifest must stay aligned with **`opencode_config.root`** (e.g. `file://~/.config/opencode/node_modules/...`).

## Regenerate plugins into `opencode.json`

Edit `fleet.jsonc`, then (paths may vary on your machine):

```bash
bun run /path/to/opencode-fleet/src/cli.ts generate-opencode-json --force
bun run /path/to/opencode-fleet/src/cli.ts install
bun run fleet:test:full-runtime
```

For the **npm** example manifest explicitly:

```bash
bun run /path/to/opencode-fleet/src/cli.ts generate-opencode-json --manifest /path/to/opencode-fleet/examples/fleet.npm.jsonc --force
bun run /path/to/opencode-fleet/src/cli.ts install --manifest /path/to/opencode-fleet/examples/fleet.npm.jsonc
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
