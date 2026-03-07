import { tool } from "@opencode-ai/plugin"
import path from "path"
import { mkdir } from "node:fs/promises"
import fs from "node:fs"

const MAX_CONTENT = 16_000

function target(directory: string) {
  return path.join(directory, ".opencode", "handoff.md")
}

export const write = tool({
  description:
    "Write or overwrite the session handoff document. Contains: goal, current state, what's done, what's next, key decisions, blockers, and active plan slugs. Read by the orchestrator at session start to resume context.",
  args: {
    content: tool.schema
      .string()
      .describe("Markdown content for the handoff document"),
  },
  async execute(args, context) {
    const content =
      args.content.length > MAX_CONTENT
        ? args.content.slice(0, MAX_CONTENT) +
          "\n\n[truncated — handoff exceeded 16KB]"
        : args.content
    const dest = target(context.directory)
    await mkdir(path.dirname(dest), { recursive: true })
    const tmp = `${dest}.tmp`
    await Bun.write(tmp, content)
    fs.renameSync(tmp, dest)
    return "handoff written"
  },
})

export const read = tool({
  description:
    "Read the session handoff document left by a previous session. Returns the handoff content if it exists. Call at session start to resume context.",
  args: {},
  async execute(_args, context) {
    const dest = target(context.directory)
    if (!fs.existsSync(dest)) return "no handoff document"
    const mtime = fs.statSync(dest).mtime.toISOString()
    return `Last updated: ${mtime}\n\n${await Bun.file(dest).text()}`
  },
})

export const done = tool({
  description:
    "Remove the session handoff document. Call after the project concludes or the handoff has been consumed.",
  args: {},
  async execute(_args, context) {
    const dest = target(context.directory)
    if (!fs.existsSync(dest)) return "no handoff to remove"
    await Bun.file(dest).delete()
    return "handoff removed"
  },
})
