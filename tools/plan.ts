import { tool } from "@opencode-ai/plugin"
import path from "path"
import { mkdir, readdir } from "node:fs/promises"
import fs from "node:fs"

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/
const MAX_CONTENT = 32_000

function validate(slug: string) {
  if (!SLUG_RE.test(slug))
    throw new Error(
      `invalid slug "${slug}" — use 2-4 lowercase hyphenated words (e.g. auth-refactor, inbox-ui)`,
    )
}

function dir(directory: string) {
  return path.join(directory, ".opencode", "plans")
}

function target(directory: string, slug: string) {
  return path.join(dir(directory), `${slug}.md`)
}

export const write = tool({
  description:
    "Write or update a persisted plan file. Use a 2-4 word hyphenated slug (e.g. auth-refactor, inbox-ui). Content should be the finalized markdown plan shown to the user.",
  args: {
    slug: tool.schema
      .string()
      .describe(
        "Plan slug: 2-4 lowercase hyphenated words identifying this plan",
      ),
    content: tool.schema
      .string()
      .describe("Markdown content for the persisted plan"),
  },
  async execute(args, context) {
    validate(args.slug)
    const content =
      args.content.length > MAX_CONTENT
        ? args.content.slice(0, MAX_CONTENT) +
          "\n\n[truncated — plan exceeded 32KB]"
        : args.content
    await mkdir(dir(context.directory), { recursive: true })
    const dest = target(context.directory, args.slug)
    const tmp = `${dest}.tmp`
    await Bun.write(tmp, content)
    fs.renameSync(tmp, dest)
    return `wrote ${args.slug}`
  },
})

export const read = tool({
  description:
    "Read persisted plan files. Call with no slug to get a compact summary of all saved plans (slug, title, last updated). Call with a slug to read the full content of a specific plan.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe("Plan slug to read. Omit to list all persisted plan files."),
  },
  async execute(args, context) {
    if (args.slug) {
      validate(args.slug)
      const dest = target(context.directory, args.slug)
      if (!(await Bun.file(dest).exists())) return `no plan file for ${args.slug}`
      const mtime = fs.statSync(dest).mtime.toISOString()
      return `Last updated: ${mtime}\n\n${await Bun.file(dest).text()}`
    }
    const base = dir(context.directory)
    if (!fs.existsSync(base)) return "no plan files"
    const entries = (await readdir(base)).filter(f => f.endsWith(".md")).sort()
    if (entries.length === 0) return "no plan files"
    const lines = await Promise.all(
      entries.map(async f => {
        const full = path.join(base, f)
        const slug = f.replace(/\.md$/, "")
        const mtime = fs.statSync(full).mtime.toISOString()
        const text = await Bun.file(full).text()
        const title =
          text
            .split("\n")
            .find(line => line.startsWith("# "))
            ?.slice(2)
            .trim() || "(untitled plan)"
        return `${slug} | ${title} | updated ${mtime}`
      }),
    )
    return lines.join("\n")
  },
})

export const done = tool({
  description:
    "Remove a completed persisted plan file. Call with a slug to remove one plan. Call WITHOUT a slug to remove ALL persisted plan files.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe("Plan slug to remove. Omit to remove ALL persisted plan files."),
  },
  async execute(args, context) {
    if (args.slug) {
      validate(args.slug)
      const dest = target(context.directory, args.slug)
      if (!(await Bun.file(dest).exists())) return `no plan file for ${args.slug}`
      await Bun.file(dest).delete()
      return `removed ${args.slug}`
    }
    const base = dir(context.directory)
    if (!fs.existsSync(base)) return "no plan files to clean"
    const entries = (await readdir(base)).filter(f => f.endsWith(".md"))
    if (entries.length === 0) return "no plan files to clean"
    await Promise.all(entries.map(f => Bun.file(path.join(base, f)).delete()))
    if ((await readdir(base)).length === 0) fs.rmdirSync(base)
    return `removed ${entries.length} plan files`
  },
})
