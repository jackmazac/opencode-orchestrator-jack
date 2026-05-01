# DCP escape hatches (orchestrator compression)

Default setup: percentage-based context limits for Bedrock 1M orchestrator models, softer nudge cadence, 6-turn protection for recent tool output, and custom nudges that allow cold delegated output compression only after it has been synthesized or acted on.

Current balance:

- Fresh/warm `<task_result>` spans stay uncompressed for at least 6 turns and longer when still active.
- Cold delegated output may be compressed only with carry-forward facts: agent/type, goal, decisions/contracts, files, commands, errors, verification, open issues, and why the raw output is no longer needed.
- Exact errors, reviewer issue tables, API contracts, verification commands/results, unpersisted plan wave definitions, and unresolved assumptions stay pinned until resolved or persisted.

If context loss is still unacceptable:

1. **`compress.permission`: `"ask"`** in `dcp.jsonc` — each `compress` requires approval; stops silent bad ranges, adds friction.
2. **Increase `turnProtection.turns`** in `dcp.jsonc` — keeps delegated outputs raw for longer before they become eligible.
3. **`manualMode.enabled`: `true`** — model stops autonomous context tools; you drive `/dcp compress` manually. Keep or disable `manualMode.automaticStrategies` depending on whether you still want dedupe/purge without autonomous compress.

Restart OpenCode after edits.
