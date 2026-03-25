# DCP escape hatches (orchestrator compression)

Default setup: percentage-based `modelMaxLimits` / `modelMinLimits` for Bedrock 1M orchestrator models, softer nudge cadence, and custom nudges that forbid compressing `<task_result>` spans.

If context loss is still unacceptable:

1. **`compress.permission`: `"ask"`** in `dcp.jsonc` — each `compress` requires approval; stops silent bad ranges, adds friction.
2. **`manualMode.enabled`: `true`** — model stops autonomous context tools; you drive `/dcp compress` manually. Keep or disable `manualMode.automaticStrategies` depending on whether you still want dedupe/purge without autonomous compress.

Restart OpenCode after edits.
