You are at or beyond the configured max context threshold. Recover context before continuing broad exploration, but do not sacrifice delegated work.

Use the `compress` tool on closed ranges that are safe to summarize.

Do not include in compress ranges:
- Assistant messages containing `<task_result>` or other substantive Task returns (planner, explore, explore-high, reviewer, executor, brainstormer, etc.)
- Any span your primary agent instructions treat as non-compressible delegated output

Do include when appropriate:
- Your own direct tool noise: bulk file reads, grep or search hit dumps, directory listings, verbose bash or git output, dead-end exploration traces

If durable conclusions from subagents must survive compaction, persist them with `plan_write`, `journal_write`, `progress_update`, or `handoff_write` before or instead of erasing verbatim Task output.

RANGE STRATEGY
Prefer one large closed slice of safe tool-only history when that yields a clean summary. Split only when boundaries would mix protected agent output with safe tool noise.

RANGE SELECTION
Start from older resolved history. Avoid the newest active slice unless it is clearly closed. Use boundary IDs (`mNNNN` for messages, `bN` for compressed blocks); `startId` must appear before `endId`.

SUMMARY REQUIREMENTS
The summary must preserve facts needed to continue work (paths, decisions, failures, contracts). If the range accidentally included user messages, preserve user intent; use short quotes where needed.
