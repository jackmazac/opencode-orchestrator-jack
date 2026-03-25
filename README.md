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
| `tools/` | Custom status tools for executor continuity |
| `dcp.jsonc` | Dynamic context pruning config (per-model limits + nudge tuning) |
| `dcp-prompts/overrides/*.md` | DCP nudge text overrides (`customPrompts` in `dcp.jsonc`) |
| `dcp-escape-hatches.md` | Stronger DCP options if compression is still too aggressive |

## Models Used

- **Orchestrator**: `anthropic.claude-opus-4-6-v1-1m` (Bedrock)
- **Planner**: `gpt-5.2` (OpenAI)
- **Executors**: Claude Sonnet/Opus (Bedrock), GPT-5.3-codex (OpenAI)
- **Reviewer**: `gpt-5.2`
- **Explore**: Claude Haiku (Bedrock), GPT-5.3-codex
- **Designer**: Claude Sonnet (Bedrock)

Adjust models in `opencode.json` if you lack access to a provider.
