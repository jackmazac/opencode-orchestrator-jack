CRITICAL: You have exceeded the max context threshold. You MUST call the `compress` tool NOW before doing anything else.

If you are in the middle of an atomic write operation, finish that single step, then compress immediately. Do not start new exploration, do not read more files, do not run more commands.

WHAT TO COMPRESS
Start from the oldest resolved history. Target the largest single closed range that is safe to summarize. Include:
- Your own tool noise: file reads, grep/search dumps, directory listings, bash output, dead-end exploration traces
- Closed research or implementation spans where findings have already been acted on
- Cold delegated output: Task/subagent returns at least 6 turns old that have already been synthesized or acted on and no longer need to remain verbatim

DO NOT COMPRESS
- Fresh or warm delegated output: `<task_result>` or substantive Task/subagent returns from the last 6 turns, not yet synthesized, still relevant to the current wave, tied to unresolved failures, or needed as exact evidence
- Pinned delegated output: exact errors, reviewer issue tables, API contracts, verification commands/results, plan wave definitions not persisted elsewhere, or unresolved assumptions
- The active working set you need for the current step

If delegated-agent conclusions must survive, persist durable state with `plan_write`, `audit_write`, `progress_update`, `audit_progress_update`, or `handoff_write` BEFORE compressing surrounding tool logs or cold delegated output. Use `journal_write` only for concise decisions/contracts/patterns, never transcripts.

RANGE SELECTION
Use boundary IDs (`mNNNN` for messages, `bN` for compressed blocks). `startId` must appear before `endId`. Prefer one large safe range over many small ones.

SUMMARY REQUIREMENTS
The summary MUST preserve all facts needed to continue work: file paths, decisions, failures, interface contracts. If the range includes user messages, preserve user intent verbatim with short quotes.
For each cold delegated return included in the range, include: agent/type, original goal, carry-forward facts, decisions/contracts, files/commands/errors, verification, open issues, and why the raw output is no longer needed.

Failure to compress now risks an unrecoverable session crash.
