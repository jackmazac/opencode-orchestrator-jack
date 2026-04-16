You have been iterating for many turns since the last user message. Context is accumulating.

You MUST call the `compress` tool on any closed portions of your finished tool traces. Do not skip this step.

Target only your own direct tool output — not Task/subagent returns or `<task_result>` blocks. Prefer several small independent closed ranges of tool-only noise when they exist. Keep active work and delegated reasoning intact.

If conclusions need to survive, anchor them with `plan_write`, `audit_write`, `journal_write`, `progress_update`, `audit_progress_update`, or `handoff_write` before compressing surrounding logs.
