# OpenCode Orchestrator Config

Multi-agent orchestrator setup for OpenCode with planner, executors, reviewer, explorer, and designer agents. Uses Claude (Bedrock) and GPT models.

## Prerequisites

- [OpenCode](https://opencode.ai) installed
- [Bun](https://bun.sh) (for plugin dependencies)
- API access to **OpenAI** and **Amazon Bedrock** (Claude models)

## Install

### 1. Clone into OpenCode config directory

```bash
# Backup existing config if needed
mv ~/.config/opencode ~/.config/opencode.bak 2>/dev/null || true

# Clone this repo as your config
git clone https://github.com/jackmazac/opencode-orchestrator-jack.git ~/.config/opencode
cd ~/.config/opencode
```

Or, if you already have other config in `~/.config/opencode`, clone elsewhere and copy:

```bash
git clone https://github.com/jackmazac/opencode-orchestrator-jack.git /tmp/opencode-orchestrator
cp -r /tmp/opencode-orchestrator/* ~/.config/opencode/
```

### 2. Install dependencies

```bash
cd ~/.config/opencode
bun install
bun run fleet:doctor -- --json
```

`fleet.jsonc` is the editable source for the local plugin fleet. `opencode.json` is generated from it with `opencode-fleet`; user-owned top-level sections such as agents, MCP servers, formatter/LSP settings, instructions, theme, and compaction are preserved while the `plugin` array is regenerated.

### 3. Configure providers

Create `~/.config/opencode/.env` (or set env vars) with your API keys. `.env` and `.env.*` are gitignored; `.env.example` is tracked and intentionally contains placeholders only. See `.env.example` for names OpenCode interpolates via `{env:…}` in `opencode.json`.

```bash
# OpenAI (for gpt-5.2, gpt-5.3-codex)
OPENAI_API_KEY=sk-...

# Amazon Bedrock (for Claude models)
# Use AWS CLI to configure: aws configure
# Or set explicit credentials:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Motif MCP (required if you use the `motif` MCP server)
E2E_AUTH_SECRET=...
```

Provider and secret expectations:

- OpenAI can be supplied through `OPENAI_API_KEY` in `.env` or the shell environment.
- Amazon Bedrock can use normal AWS configuration (`aws configure`, SSO, or environment variables such as `AWS_PROFILE`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`).
- Exa and Motif secrets are stored in macOS Keychain when possible; inspect with commands such as `security find-generic-password -s <service> -w` instead of committing secrets to this repo.
- Fleet reports and plugin telemetry are local-only diagnostics and must not include raw secrets, API keys, prompts, or payloads.

### 4. Run OpenCode

```bash
opencode
```

## Structure

| Path | Purpose |
|------|---------|
| `opencode.json` | Main config: agents, models, prompts |
| `prompts/*.txt` | Agent prompt templates |
| `plugin/shell-strategy/shell_strategy.md` | Vendored copy of [JRedeker/opencode-shell-strategy](https://github.com/JRedeker/opencode-shell-strategy) (`shell_strategy.md` + `LICENSE` in that folder) |
| `tools/` | OpenCode plugin tools: audits, progress, journal, handoff, executor status (see below) |
| `dcp.jsonc` | Dynamic context pruning config (per-model limits + nudge tuning) |
| `dcp-prompts/overrides/*.md` | DCP nudge text overrides (`customPrompts` in `dcp.jsonc`) |
| `dcp-escape-hatches.md` | Stronger DCP options if compression is still too aggressive |
| `fleet.jsonc` | Editable source for local plugin fleet install/doctor/test |
| `.opencode-fleet.lock.json` | Generated manifest hash and plugin array lock written by `opencode-fleet` |

### Persisted artifacts

This config repo must not contain project/session state under `~/.config/opencode/.opencode/`. Conductor and Engram artifacts are project-local: each real worktree owns its own `.opencode/` directory (for example `.opencode/plans/`, `.opencode/status/`, and `.opencode/memory.db`). The config `.gitignore` ignores `.opencode/` to prevent accidental global memory DBs, snapshots, lifecycle artifacts, nested lockfiles, and stale session scratch from returning.

| File | Tools (typical names) | Storage |
|------|----------------------|---------|
| `opencode-conductor` plugin | `persist_subplan`, `read_subplan`, `discard_subplan` | `.opencode/subplans/<slug>.md` — planner draft/intermediary plans for orchestrator synthesis |
| `opencode-conductor` plugin | `persist_final_plan`, `read_final_plan`, `discard_final_plan` | `.opencode/plans/<slug>.md` — canonical final plans; executors/reviewers/scribes load via `read_final_plan` (`Plan:` header in prompts) |
| `audit.ts` | `audit_write`, `audit_read`, `audit_done` | `.opencode/audits/<slug>.md` — **orchestrator only**; subagents do not call `audit_read`; inline slice context in `task` prompts |
| `progress.ts` | `progress_update`, `progress_read`, `progress_done` | `.opencode/progress/<plan_slug>.json` — wave state per plan |
| `audit-progress.ts` | `audit_progress_update`, `audit_progress_read`, `audit_progress_done` | `.opencode/audit-progress/<audit_slug>.json` — wave state per persisted audit |
| `status.ts` | `status_write`, `status_read`, `status_done` | `.opencode/status/<slug>.json` — compact transient executor scratch state, not transcripts |
| `journal.ts` | `journal_write`, `journal_read`, `journal_done` | `.opencode/journal.jsonl` — concise durable decisions/contracts/patterns only |
| `opencode-conductor` plugin | `context_usage` | OpenCode session messages via the host client — context-budget diagnostic; no config-local product plugin remains |

Slug rules and read caps are enforced by the Conductor plan tools. Use `read_subplan({ slug, section })` or `read_final_plan({ slug, section })` to load one markdown heading from large plans.

## Models Used

- **Orchestrator**: `anthropic.claude-opus-4-6-v1-1m` (Bedrock)
- **Planner**: `gpt-5.2` (OpenAI)
- **Executors**: Claude Sonnet/Opus (Bedrock), GPT-5.3-codex (OpenAI)
- **Reviewer**: `gpt-5.2`
- **Explore**: Claude Haiku (Bedrock), GPT-5.3-codex
- **Designer**: Claude Sonnet (Bedrock)

Adjust models in `opencode.json` if you lack access to a provider.

## Fleet operations

Common commands from `~/.config/opencode`:

```bash
bun run fleet:doctor -- --json
bun run fleet:test -- --json
bun run fleet:test:full-runtime
bun run fleet:hygiene -- --strict --json
bun run check
```

`scripts/preflight.ts` was removed because Fleet now owns duplicate coverage: `doctor` validates config/plugin paths and telemetry sink shape, `test` validates enabled plugin command/runtime contracts against `expected_tools`, and `hygiene --strict` validates lockfile/toolchain hygiene.

## Branch merge plan (`plan-persistence-config` → `main`)

Merge this branch to `main` only after all Wave 7 gates are true:

1. `opencode.json` generation is deterministic and only the `plugin` array is Fleet-managed.
2. Drift is cleared and `.opencode-fleet.lock.json` records the current manifest hash and generated plugin array.
3. Package scripts are stable (`preflight` delegates to Fleet; `check` runs Fleet doctor/test plus Bun tests).
4. No secrets or machine/session state are tracked: `.env` stays ignored, `.env.example` is tracked, and global `.opencode/` artifacts were archived outside the repo then removed.

The merge itself is intentionally a follow-up operation; this branch documents the plan and contains the generated/config cleanup changes only.
