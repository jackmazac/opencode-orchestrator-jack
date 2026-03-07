import { tool } from "@opencode-ai/plugin"
import path from "path"
import { mkdir } from "node:fs/promises"
import fs from "node:fs"

const TYPES = ["decision", "contract", "discovery", "pattern"] as const
const MAX_ENTRY = 2000

function target(directory: string) {
  return path.join(directory, ".opencode", "journal.jsonl")
}

export const write = tool({
  description:
    "Append an entry to the persistent decision journal. Use to record architectural decisions, interface contracts, discoveries, and established patterns that downstream waves or future sessions need. Entries are immutable once written.",
  args: {
    type: tool.schema
      .string()
      .describe(
        "Entry type: decision | contract | discovery | pattern",
      ),
    content: tool.schema
      .string()
      .describe(
        "Freeform markdown content for the journal entry (max 2000 chars)",
      ),
  },
  async execute(args, context) {
    if (!TYPES.includes(args.type as (typeof TYPES)[number]))
      throw new Error(
        `invalid type "${args.type}" — use: ${TYPES.join(", ")}`,
      )
    const content =
      args.content.length > MAX_ENTRY
        ? args.content.slice(0, MAX_ENTRY) + " [truncated]"
        : args.content
    const dest = target(context.directory)
    await mkdir(path.dirname(dest), { recursive: true })
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      type: args.type,
      content,
    })
    fs.appendFileSync(dest, entry + "\n")
    return `journal: appended ${args.type} entry`
  },
})

export const read = tool({
  description:
    "Read the persistent decision journal. Returns all entries or the last N entries. Each entry has a timestamp, type, and content.",
  args: {
    last_n: tool.schema
      .number()
      .optional()
      .describe(
        "Return only the last N entries. Omit to return all.",
      ),
  },
  async execute(args, context) {
    const dest = target(context.directory)
    if (!fs.existsSync(dest)) return "no journal entries"
    const lines = (await Bun.file(dest).text()).trim().split("\n").filter(Boolean)
    if (lines.length === 0) return "no journal entries"
    const entries = args.last_n ? lines.slice(-args.last_n) : lines
    return entries
      .map((line) => {
        const e = JSON.parse(line)
        return `[${e.ts}] ${e.type}: ${e.content}`
      })
      .join("\n\n")
  },
})

export const done = tool({
  description:
    "Remove the decision journal. Call after a project concludes to clean up.",
  args: {},
  async execute(_args, context) {
    const dest = target(context.directory)
    if (!fs.existsSync(dest)) return "no journal to clean"
    await Bun.file(dest).delete()
    return "journal cleared"
  },
})
