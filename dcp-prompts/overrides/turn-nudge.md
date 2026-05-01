New turn. Evaluate context and compress if any closed ranges exist.

If you have finished tool traces, resolved exploration, or direction has shifted, call the `compress` tool on those closed ranges now. Do not defer compression — stale context reduces your effectiveness and risks a session crash.

Choose small or medium closed ranges of your own direct tool output first. When earlier delegated output is cold — at least 6 turns old, already synthesized or acted on, no longer needed verbatim, and not tied to unresolved failures — it may also be compressed with a carry-forward summary.

Keep active context and fresh, warm, or pinned delegated-agent output uncompressed. This includes recent `<task_result>` blocks, current-wave planner/reviewer/executor evidence, exact errors, reviewer issue tables, API contracts, verification commands/results, plan wave definitions not persisted elsewhere, and unresolved assumptions. If space is tight, persist durable state via `plan_write`, `audit_write`, `progress_update`, `audit_progress_update`, or `handoff_write` before compressing cold Task output. Use `journal_write` only for concise decisions/contracts/patterns, never transcripts.
