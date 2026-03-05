import { tool } from "@opencode-ai/plugin"
import path from "path"
import { mkdir, readdir } from "node:fs/promises"
import fs from "node:fs"

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/
const MAX_CONTENT = 4000
const DIR = path.join(process.cwd(), ".opencode", "status")

function validate(slug: string) {
  if (!SLUG_RE.test(slug))
    throw new Error(
      `invalid slug "${slug}" — use 2-4 lowercase hyphenated words (e.g. api-routes, db-schema)`,
    )
}

function target(slug: string) {
  return path.join(DIR, `${slug}.md`)
}

export const write = tool({
  description:
    "Write or update an executor status file. Use a 2-4 word hyphenated slug (e.g. api-routes, db-schema). Content should be markdown with Goal, Discoveries, Tasks (checklist), and Current sections.",
  args: {
    slug: tool.schema
      .string()
      .describe(
        "Task slug: 2-4 lowercase hyphenated words identifying this task",
      ),
    content: tool.schema
      .string()
      .describe("Markdown content for the status file"),
  },
  async execute(args) {
    validate(args.slug)
    const content =
      args.content.length > MAX_CONTENT
        ? args.content.slice(0, MAX_CONTENT) +
          "\n\n[truncated — status exceeded 4KB]"
        : args.content
    await mkdir(DIR, { recursive: true })
    const dest = target(args.slug)
    const tmp = `${dest}.tmp`
    await Bun.write(tmp, content)
    fs.renameSync(tmp, dest)
    return `wrote ${args.slug}`
  },
})

export const read = tool({
  description:
    "Read executor status files. Call with no slug to get a compact summary of all active status files (slug, current task, last updated). Call with a slug to read the full content of a specific status file.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe(
        "Task slug to read. Omit to list all status files with summary.",
      ),
  },
  async execute(args) {
    if (args.slug) {
      validate(args.slug)
      const dest = target(args.slug)
      if (!(await Bun.file(dest).exists())) return `no status file for ${args.slug}`
      const mtime = fs.statSync(dest).mtime.toISOString()
      return `Last updated: ${mtime}\n\n${await Bun.file(dest).text()}`
    }
    if (!fs.existsSync(DIR)) return "no status files"
    const entries = (await readdir(DIR)).filter(f => f.endsWith(".md")).sort()
    if (entries.length === 0) return "no status files"
    const lines = await Promise.all(
      entries.map(async f => {
        const full = path.join(DIR, f)
        const slug = f.replace(/\.md$/, "")
        const mtime = fs.statSync(full).mtime.toISOString()
        const text = await Bun.file(full).text()
        const match = text.match(/Working on:\s*(.*)/)
        const current = match ? match[1].trim() : "(no current task)"
        return `${slug} | ${current} | updated ${mtime}`
      }),
    )
    return lines.join("\n")
  },
})

export const done = tool({
  description:
    "Remove a completed status file. Call with a slug to remove one executor's file. Call WITHOUT a slug to remove ALL status files — this is reserved for the orchestrator's final cleanup only.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe(
        "Task slug to remove. Omit to remove ALL status files (orchestrator-only).",
      ),
  },
  async execute(args) {
    if (args.slug) {
      validate(args.slug)
      const dest = target(args.slug)
      if (!(await Bun.file(dest).exists())) return `no status file for ${args.slug}`
      await Bun.file(dest).delete()
      return `removed ${args.slug}`
    }
    if (!fs.existsSync(DIR)) return "no status files to clean"
    const entries = (await readdir(DIR)).filter(f => f.endsWith(".md"))
    if (entries.length === 0) return "no status files to clean"
    await Promise.all(
      entries.map(f => Bun.file(path.join(DIR, f)).delete()),
    )
    try {
      fs.rmdirSync(DIR)
    } catch {}
    return `removed ${entries.length} status files`
  },
})
