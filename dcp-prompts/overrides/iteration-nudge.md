You have been iterating for many turns since the last user message. Context is accumulating.

You MUST call the `compress` tool on any closed portions of your finished tool traces. Do not skip this step.

Target your own direct tool output first. Prefer several small independent closed ranges of tool-only noise when they exist. You may also compress cold Task/subagent returns or `<task_result>` blocks when they are at least 6 turns old, already synthesized or acted on, no longer needed verbatim, and all carry-forward facts are preserved.

Keep active work and fresh, warm, or pinned delegated reasoning intact. Pinned content includes exact errors, reviewer issue tables, API contracts, verification commands/results, plan wave definitions not persisted elsewhere, and unresolved assumptions. If conclusions need to survive, anchor durable state with `plan_write`, `audit_write`, `progress_update`, `audit_progress_update`, or `handoff_write` before compressing surrounding logs or cold delegated returns. Use `journal_write` only for concise decisions/contracts/patterns, never transcripts.
