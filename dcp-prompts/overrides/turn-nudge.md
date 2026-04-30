New turn. Evaluate context and compress if any closed ranges exist.

If you have finished tool traces, resolved exploration, or direction has shifted, call the `compress` tool on those closed ranges now. Do not defer compression — stale context reduces your effectiveness and risks a session crash.

Choose small or medium closed ranges of your own direct tool output — not Task/subagent returns or `<task_result>` blocks. When earlier work is clearly finished and only tool noise remains, compress it.

Keep active context and all substantive delegated-agent output uncompressed. If space is tight, persist durable state via `plan_write`, `audit_write`, `progress_update`, `audit_progress_update`, or `handoff_write` rather than summarizing away Task output. Use `journal_write` only for concise decisions/contracts/patterns, never transcripts.
