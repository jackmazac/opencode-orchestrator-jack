---
name: get-code-context-exa
description: Code context using Exa. Finds real snippets and docs from GitHub, StackOverflow, and technical docs. Use when searching for code examples, API syntax, library documentation, or debugging help.
allowed-tools: exa_web_search_exa, exa_web_fetch_exa
---

# Code Context (Exa)

## Tool Restriction (Critical)

ONLY use `exa_web_search_exa` for code lookups, and `exa_web_fetch_exa` to read a specific page returned by the search. Do NOT use other Exa tools.

> Note: Exa's older `get_code_context_exa` tool is deprecated; `web_search_exa` is the current recommended entry point per Exa's docs.

## Token Isolation (Critical)

Never run Exa code searches in main context. Always delegate to a subagent:

- Spawn a subagent with the `task` tool (or equivalent in your OpenCode environment).
- Subagent calls `exa_web_search_exa` with a focused, language-scoped query.
- Optionally calls `exa_web_fetch_exa` on the single best URL when the snippet inside the search result is not sufficient.
- Subagent extracts the minimum viable snippet(s) plus version/constraint notes.
- Subagent deduplicates near-identical results (mirrors, forks, repeated StackOverflow answers) before returning.
- Subagent returns copyable snippets and a brief explanation only.
- Main context stays clean regardless of search volume.

## When to Use

Use this skill for ANY external programming-related lookup:

- API usage and syntax.
- SDK or library examples.
- Config and setup patterns.
- Framework "how to" questions.
- Debugging where you need authoritative snippets.

Do NOT use it for:

- Local codebase questions (use `Grep`, `Read`, semantic search).
- General web research unrelated to code (use a normal web search tool).
- Questions answerable by fleet plugins: prefer Codemem (`codemem_*`) for local code-graph truth and Engram (`memory_context`, `memory`) for prior decisions.

## Inputs

`exa_web_search_exa` core inputs:

- `query` (string, required) — see query patterns below.
- `numResults` (number, optional) — keep small (3–8) for code lookups.

`exa_web_fetch_exa` core inputs:

- `urls` (string or array, required) — URLs returned from a prior `web_search_exa` call.

## Query Writing Patterns (High Signal)

Code search depends almost entirely on query quality. Reduce cross-language and cross-version noise:

- Always include the **programming language**. Use `"Go generics constraints"`, not `"generics"`.
- Include **framework + version** when relevant: `"Next.js 14 app router"`, `"React 19 use hook"`, `"Python 3.12 typing"`, `"Bun 1.x sqlite"`.
- Include exact identifiers when known: function or class names, config keys, error messages.
- Bias the query toward authoritative sources by naming them: `"site:github.com"`, `"docs.<library>.com"`, or include `"official docs"` / `"reference"`.
- Prefer one focused query over a broad one. If the topic has two parts, run two focused searches.

Examples:

- ✅ `"Drizzle ORM SQLite migrations TypeScript example github"`
- ✅ `"Tailwind v4 CSS-first config @theme directive docs"`
- ❌ `"how to do migrations"` (language, framework, version all missing)

## Result Strategy

- Start with `numResults: 3–5`. Bump to 8 only if the first pass returns mostly noise.
- Read snippets in the search result first. Only call `exa_web_fetch_exa` when the snippet is truncated or you need surrounding context.
- When fetching, fetch ONE URL — the best one. Don't bulk-fetch.

## Output Format

The subagent should return to main context:

1. Best minimal working snippet(s), copy/paste friendly.
2. Notes on version, constraints, and gotchas.
3. Sources (URLs from the returned context).

Before presenting, deduplicate similar results and keep only the best representative snippet per approach.

## Fleet Notes

- The Exa MCP server is configured in `~/.config/opencode/opencode.json` under `mcp.exa` with `web_search_exa`, `web_fetch_exa`, and `web_search_advanced_exa` enabled via the `?tools=` query parameter. Tools are exposed in OpenCode as `exa_<tool_name>` (e.g. `exa_web_search_exa`). See [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/).
- Authentication uses the `x-api-key` header. Per `~/.config/opencode/AGENTS.md`, prefer moving the literal key into `.env` and referencing it as `{env:EXA_API_KEY}` in `opencode.json`.
- This skill is for **external** snippets and docs only. For local impact, drift, or API-surface analysis use Codemem (`codemem_*`). For project memory and prior decisions use Engram (`memory_context`, `memory`).

## References

- [Exa MCP](https://exa.ai/docs/reference/exa-mcp)
- [Exa code search Claude skill (original, used `get_code_context_exa`)](https://exa.ai/docs/reference/code-search-claude-skill)
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/)
