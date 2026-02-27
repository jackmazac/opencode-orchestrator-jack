import { tool } from "@opencode-ai/plugin"
import path from "path"

const script = path.join(import.meta.dirname, "status_impl.py")

export const write = tool({
  description:
    "Write or update an executor status file. Use a 2-4 word hyphenated slug (e.g. api-routes, db-schema). Content should be markdown with Goal, Discoveries, Tasks (checklist), and Current sections.",
  args: {
    slug: tool.schema.string().describe("Task slug: 2-4 lowercase hyphenated words identifying this task"),
    content: tool.schema.string().describe("Markdown content for the status file"),
  },
  async execute(args) {
    return await Bun.$`python3 ${script} write ${args.slug} ${args.content}`.text()
  },
})

export const read = tool({
  description:
    "Read executor status files. Call with no slug to list all active status files, or with a slug to read a specific one. Use on startup to check for prior progress to resume.",
  args: {
    slug: tool.schema.string().optional().describe("Task slug to read. Omit to read all status files."),
  },
  async execute(args) {
    if (args.slug) return await Bun.$`python3 ${script} read ${args.slug}`.text()
    return await Bun.$`python3 ${script} read`.text()
  },
})

export const done = tool({
  description:
    "Remove a completed status file, or all status files when the session is finished. Call with a slug to remove one, or without to clean up everything.",
  args: {
    slug: tool.schema.string().optional().describe("Task slug to remove. Omit to remove all status files."),
  },
  async execute(args) {
    if (args.slug) return await Bun.$`python3 ${script} done ${args.slug}`.text()
    return await Bun.$`python3 ${script} done`.text()
  },
})
