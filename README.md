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

Create `~/.config/opencode/.env` (or set env vars) with your API keys:

```bash
# OpenAI (for gpt-5.2, gpt-5.3-codex)
OPENAI_API_KEY=sk-...

# Amazon Bedrock (for Claude models)
# Use AWS CLI to configure: aws configure
# Or set explicit credentials:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
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
| `plugin/shell-strategy/` | Non-interactive shell rules (from [JRedeker/opencode-shell-strategy](https://github.com/JRedeker/opencode-shell-strategy)) |
| `tools/` | OpenCode plugin tools: plans, audits, progress, journal, handoff, executor status (see below) |
| `dcp.jsonc` | Dynamic context pruning config (per-model limits + nudge tuning) |
| `dcp-prompts/overrides/*.md` | DCP nudge text overrides (`customPrompts` in `dcp.jsonc`) |
| `dcp-escape-hatches.md` | Stronger DCP options if compression is still too aggressive |

### Persisted artifacts (`tools/`)

| File | Tools (typical names) | Storage |
|------|----------------------|---------|
| `plan.ts` | `plan_write`, `plan_read`, `plan_done` | `.opencode/plans/<slug>.md` — subagents load via `plan_read` (`Plan:` header in prompts) |
| `audit.ts` | `audit_write`, `audit_read`, `audit_done` | `.opencode/audits/<slug>.md` — **orchestrator only**; subagents do not call `audit_read`; inline slice context in `task` prompts |
| `progress.ts` | `progress_update`, `progress_read`, `progress_done` | `.opencode/progress/<plan_slug>.json` — wave state per plan |
| `audit-progress.ts` | `audit_progress_update`, `audit_progress_read`, `audit_progress_done` | `.opencode/audit-progress/<audit_slug>.json` — wave state per persisted audit |
| `status.ts` | `status_write`, `status_read`, `status_done` | `.opencode/status/<slug>.json` — compact transient executor scratch state, not transcripts |
| `journal.ts` | `journal_write`, `journal_read`, `journal_done` | `.opencode/journal.jsonl` — concise durable decisions/contracts/patterns only |

Slug rules and 32KB markdown cap match the plan tools. See `prompts/orchestrator.txt` (`## Persisted audits`) for when to use audits vs plans.

## Models Used

- **Orchestrator**: `anthropic.claude-opus-4-6-v1-1m` (Bedrock)
- **Planner**: `gpt-5.2` (OpenAI)
- **Executors**: Claude Sonnet/Opus (Bedrock), GPT-5.3-codex (OpenAI)
- **Reviewer**: `gpt-5.2`
- **Explore**: Claude Haiku (Bedrock), GPT-5.3-codex
- **Designer**: Claude Sonnet (Bedrock)

Adjust models in `opencode.json` if you lack access to a provider.
