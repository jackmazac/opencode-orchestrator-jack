import { tool } from "@opencode-ai/plugin";
import path from "path";
import { mkdir } from "node:fs/promises";
import fs from "node:fs";

const TYPES = ["decision", "contract", "discovery", "pattern"] as const;
const MAX_ENTRY = 800;
const READ_DEFAULT = 3;
const READ_MAX = 10;
const READ_ENTRY_CAP = 200;

function target(directory: string) {
  return path.join(directory, ".opencode", "journal.jsonl");
}

export const write = tool({
  description:
    "Append an entry to the persistent decision journal. Use to record architectural decisions, interface contracts, discoveries, and established patterns that downstream waves or future sessions need. Entries are immutable once written.",
  args: {
    type: tool.schema.string().describe("Entry type: decision | contract | discovery | pattern"),
    content: tool.schema
      .string()
      .describe("Durable conclusion only, not transcript text (max 800 chars)"),
  },
  async execute(args, context) {
    if (!TYPES.includes(args.type as (typeof TYPES)[number]))
      throw new Error(`invalid type "${args.type}" — use: ${TYPES.join(", ")}`);
    const content =
      args.content.length > MAX_ENTRY
        ? args.content.slice(0, MAX_ENTRY) + " [truncated]"
        : args.content;
    const dest = target(context.directory);
    await mkdir(path.dirname(dest), { recursive: true });
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      type: args.type,
      content,
    });
    fs.appendFileSync(dest, entry + "\n");
    return `journal: appended ${args.type} entry`;
  },
});

export const read = tool({
  description:
    "Read the persistent decision journal. Returns the last N entries (default 5). Each entry has a timestamp, type, and content. Entries are truncated to 300 chars.",
  args: {
    last_n: tool.schema.number().optional().describe("Return only the last N entries (default 5)."),
  },
  async execute(args, context) {
    const dest = target(context.directory);
    if (!fs.existsSync(dest)) return "no journal entries";
    const lines = (await Bun.file(dest).text()).trim().split("\n").filter(Boolean);
    if (lines.length === 0) return "no journal entries";
    const requested = Math.max(1, Math.floor(args.last_n ?? READ_DEFAULT));
    const n = Math.min(requested, READ_MAX);
    const skipped = Math.max(0, lines.length - n);
    const entries = lines.slice(-n);
    const clamped = requested > READ_MAX ? `, requested ${requested} clamped to ${READ_MAX}` : "";
    const header = `${lines.length} total entries${skipped > 0 ? ` (showing last ${n}, ${skipped} omitted${clamped})` : clamped ? ` (${clamped.slice(2)})` : ""}`;
    const body = entries
      .map((line) => {
        const e = JSON.parse(line);
        const text =
          e.content.length > READ_ENTRY_CAP ? e.content.slice(0, READ_ENTRY_CAP) + "…" : e.content;
        return `[${e.ts}] ${e.type}: ${text}`;
      })
      .join("\n");
    return `${header}\n${body}`;
  },
});

export const done = tool({
  description: "Remove the decision journal. Call after a project concludes to clean up.",
  args: {},
  async execute(_args, context) {
    const dest = target(context.directory);
    if (!fs.existsSync(dest)) return "no journal to clean";
    await Bun.file(dest).delete();
    return "journal cleared";
  },
});
