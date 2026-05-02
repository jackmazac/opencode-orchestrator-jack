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
```

### 3. Configure providers

Create `~/.config/opencode/.env` (or set env vars) with your API keys. See `.env.example` for names OpenCode interpolates via `{env:…}` in `opencode.json`.

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

### Persisted artifacts

| File | Tools (typical names) | Storage |
|------|----------------------|---------|
| `opencode-conductor` plugin | `persist_subplan`, `read_subplan`, `discard_subplan` | `.opencode/subplans/<slug>.md` — planner draft/intermediary plans for orchestrator synthesis |
| `opencode-conductor` plugin | `persist_final_plan`, `read_final_plan`, `discard_final_plan` | `.opencode/plans/<slug>.md` — canonical final plans; executors/reviewers/scribes load via `read_final_plan` (`Plan:` header in prompts) |
| `audit.ts` | `audit_write`, `audit_read`, `audit_done` | `.opencode/audits/<slug>.md` — **orchestrator only**; subagents do not call `audit_read`; inline slice context in `task` prompts |
| `progress.ts` | `progress_update`, `progress_read`, `progress_done` | `.opencode/progress/<plan_slug>.json` — wave state per plan |
| `audit-progress.ts` | `audit_progress_update`, `audit_progress_read`, `audit_progress_done` | `.opencode/audit-progress/<audit_slug>.json` — wave state per persisted audit |
| `status.ts` | `status_write`, `status_read`, `status_done` | `.opencode/status/<slug>.json` — compact transient executor scratch state, not transcripts |
| `journal.ts` | `journal_write`, `journal_read`, `journal_done` | `.opencode/journal.jsonl` — concise durable decisions/contracts/patterns only |

Slug rules and read caps are enforced by the Conductor plan tools. Use `read_subplan({ slug, section })` or `read_final_plan({ slug, section })` to load one markdown heading from large plans.

## Models Used

- **Orchestrator**: `anthropic.claude-opus-4-6-v1-1m` (Bedrock)
- **Planner**: `gpt-5.2` (OpenAI)
- **Executors**: Claude Sonnet/Opus (Bedrock), GPT-5.3-codex (OpenAI)
- **Reviewer**: `gpt-5.2`
- **Explore**: Claude Haiku (Bedrock), GPT-5.3-codex
- **Designer**: Claude Sonnet (Bedrock)

Adjust models in `opencode.json` if you lack access to a provider.
