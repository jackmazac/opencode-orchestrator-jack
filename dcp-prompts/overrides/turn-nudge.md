Evaluate whether compression is needed on this turn.

If you compress, choose small or medium closed ranges of your own direct tool chatter—not Task/subagent returns or anything containing `<task_result>`.

When earlier work is clearly finished and only tool noise remains, compress those closed ranges. If direction shifted, trim earlier tool-heavy slices that are no longer relevant.

Keep active context and all substantive delegated-agent output uncompressed. If space is tight, persist conclusions via `plan_write`, `journal_write`, or `handoff_write` rather than summarizing away Task output.
