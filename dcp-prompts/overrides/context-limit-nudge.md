CRITICAL: You have exceeded the max context threshold. You MUST call the `compress` tool NOW before doing anything else.

If you are in the middle of an atomic write operation, finish that single step, then compress immediately. Do not start new exploration, do not read more files, do not run more commands.

WHAT TO COMPRESS
Start from the oldest resolved history. Target the largest single closed range that is safe to summarize. Include:
- Your own tool noise: file reads, grep/search dumps, directory listings, bash output, dead-end exploration traces
- Closed research or implementation spans where findings have already been acted on

DO NOT COMPRESS
- Assistant messages containing `<task_result>` or substantive Task/subagent returns
- Any span your primary agent instructions treat as non-compressible delegated output
- The active working set you need for the current step

If delegated-agent conclusions must survive, persist them with `plan_write`, `audit_write`, `journal_write`, `progress_update`, `audit_progress_update`, or `handoff_write` BEFORE compressing surrounding tool logs.

RANGE SELECTION
Use boundary IDs (`mNNNN` for messages, `bN` for compressed blocks). `startId` must appear before `endId`. Prefer one large safe range over many small ones.

SUMMARY REQUIREMENTS
The summary MUST preserve all facts needed to continue work: file paths, decisions, failures, interface contracts. If the range includes user messages, preserve user intent verbatim with short quotes.

Failure to compress now risks an unrecoverable session crash.
