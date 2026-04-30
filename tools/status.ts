import { tool } from "@opencode-ai/plugin";
import path from "path";
import { mkdir, readdir } from "node:fs/promises";
import fs from "node:fs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;
const FIELD_CAP = 240;
const CURRENT_CAP = 180;
const LIST_ITEM_CAP = 160;
const LIST_LIMIT = 8;
const READ_LIMIT = 10;

type Status = {
  slug: string;
  goal?: string;
  plan?: string;
  wave?: string;
  current?: string;
  completed: string[];
  pending: string[];
  blockers: string[];
  touched_files: string[];
  updated: string;
};

function validate(slug: string) {
  if (!SLUG_RE.test(slug))
    throw new Error(
      `invalid slug "${slug}" - use 2-4 lowercase hyphenated words (e.g. api-routes, db-schema)`,
    );
}

function dir(directory: string) {
  return path.join(directory, ".opencode", "status");
}

function target(directory: string, slug: string) {
  return path.join(dir(directory), `${slug}.json`);
}

function legacyTarget(directory: string, slug: string) {
  return path.join(dir(directory), `${slug}.md`);
}

function cap(text: string | undefined, limit = FIELD_CAP) {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}

function capList(items: string[] | undefined) {
  if (!items) return undefined;
  return items.slice(0, LIST_LIMIT).map((item) => cap(item, LIST_ITEM_CAP) || "");
}

function emptyStatus(slug: string): Status {
  return {
    slug,
    completed: [],
    pending: [],
    blockers: [],
    touched_files: [],
    updated: new Date().toISOString(),
  };
}

async function loadStatus(directory: string, slug: string) {
  const dest = target(directory, slug);
  if (!fs.existsSync(dest)) return emptyStatus(slug);
  return { ...emptyStatus(slug), ...JSON.parse(await Bun.file(dest).text()) };
}

function render(status: Status) {
  const lines = [
    `Last updated: ${status.updated}`,
    `Goal: ${status.goal || "(not set)"}`,
    `Plan: ${status.plan || "(none)"}${status.wave ? ` | Wave: ${status.wave}` : ""}`,
    `Current: ${status.current || "(not set)"}`,
    `Completed (${status.completed.length}): ${status.completed.join("; ") || "none"}`,
    `Pending (${status.pending.length}): ${status.pending.join("; ") || "none"}`,
    `Blockers (${status.blockers.length}): ${status.blockers.join("; ") || "none"}`,
    `Touched files (${status.touched_files.length}): ${status.touched_files.join("; ") || "none"}`,
  ];
  return lines.join("\n");
}

export const write = tool({
  description:
    "Write or update compact executor status. Use small structured fields, not markdown transcripts. Omit unchanged fields; arrays replace prior arrays. Intended for resumability only.",
  args: {
    slug: tool.schema
      .string()
      .describe("Task slug: 2-4 lowercase hyphenated words identifying this task"),
    goal: tool.schema.string().optional().describe("One-sentence goal, max ~240 chars"),
    plan: tool.schema.string().optional().describe("Plan slug, if any"),
    wave: tool.schema.string().optional().describe("Wave or task id, if any"),
    current: tool.schema.string().optional().describe("Current activity, max ~180 chars"),
    completed: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Completed task labels; max 8 retained"),
    pending: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Pending task labels; max 8 retained"),
    blockers: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Active blockers; max 8 retained"),
    touched_files: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Relevant file paths touched or owned; max 8 retained"),
  },
  async execute(args, context) {
    validate(args.slug);
    const existing = await loadStatus(context.directory, args.slug);
    const next: Status = {
      ...existing,
      goal: cap(args.goal) ?? existing.goal,
      plan: cap(args.plan, 80) ?? existing.plan,
      wave: cap(args.wave, 80) ?? existing.wave,
      current: cap(args.current, CURRENT_CAP) ?? existing.current,
      completed: capList(args.completed) ?? existing.completed,
      pending: capList(args.pending) ?? existing.pending,
      blockers: capList(args.blockers) ?? existing.blockers,
      touched_files: capList(args.touched_files) ?? existing.touched_files,
      updated: new Date().toISOString(),
    };
    await mkdir(dir(context.directory), { recursive: true });
    const dest = target(context.directory, args.slug);
    const tmp = `${dest}.tmp`;
    await Bun.write(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, dest);
    return `status updated: ${args.slug} (${next.completed.length} done, ${next.pending.length} pending, ${next.blockers.length} blockers)`;
  },
});

export const read = tool({
  description:
    "Read compact executor status. Call with no slug to list up to 10 active status files. Call with a slug to read that compact status only.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe("Task slug to read. Omit to list active status files with compact summaries."),
  },
  async execute(args, context) {
    const base = dir(context.directory);
    if (args.slug) {
      validate(args.slug);
      const dest = target(context.directory, args.slug);
      if (!fs.existsSync(dest)) return `no status file for ${args.slug}`;
      return render(JSON.parse(await Bun.file(dest).text()));
    }
    if (!fs.existsSync(base)) return "no status files";
    const entries = (await readdir(base))
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const full = path.join(base, f);
        return { file: f, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    if (entries.length === 0) return "no status files";
    const shown = entries.slice(0, READ_LIMIT);
    const lines = await Promise.all(
      shown.map(async ({ file }) => {
        const full = path.join(base, file);
        const status: Status = JSON.parse(await Bun.file(full).text());
        return `${status.slug} | ${status.current || "(no current task)"} | ${status.completed.length}/${status.completed.length + status.pending.length} done | updated ${status.updated}`;
      }),
    );
    const omitted = entries.length - shown.length;
    return `${entries.length} active status file${entries.length === 1 ? "" : "s"}${omitted > 0 ? ` (showing newest ${READ_LIMIT}, ${omitted} omitted)` : ""}\n${lines.join("\n")}`;
  },
});

export const done = tool({
  description:
    "Remove completed status. Call with a slug to remove one executor status. Call WITHOUT a slug to remove ALL status files — orchestrator final cleanup only.",
  args: {
    slug: tool.schema
      .string()
      .optional()
      .describe("Task slug to remove. Omit to remove ALL status files (orchestrator-only)."),
  },
  async execute(args, context) {
    const base = dir(context.directory);
    if (args.slug) {
      validate(args.slug);
      const dest = target(context.directory, args.slug);
      const legacy = legacyTarget(context.directory, args.slug);
      const removed = [];
      if (fs.existsSync(dest)) {
        await Bun.file(dest).delete();
        removed.push(dest);
      }
      if (fs.existsSync(legacy)) {
        await Bun.file(legacy).delete();
        removed.push(legacy);
      }
      return removed.length ? `removed ${args.slug}` : `no status file for ${args.slug}`;
    }
    if (!fs.existsSync(base)) return "no status files to clean";
    const entries = (await readdir(base)).filter((f) => f.endsWith(".json") || f.endsWith(".md"));
    if (entries.length === 0) return "no status files to clean";
    await Promise.all(entries.map((f) => Bun.file(path.join(base, f)).delete()));
    try {
      if ((await readdir(base)).length === 0) fs.rmdirSync(base);
    } catch {}
    return `removed ${entries.length} status files`;
  },
});
