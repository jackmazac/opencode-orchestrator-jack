/**
 * Host adapter tests.
 *
 * Covers:
 *   - The exact codemem-style bug (args is a ZodObject, not ZodRawShape).
 *   - Missing description / execute / args.
 *   - Plugin returning non-object hooks.
 *   - Tool execute throws are wrapped, not propagated.
 *   - Telemetry events emit correctly to a temp ndjson file.
 *   - validateToolDefinitions returns useful error strings.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { validateToolDefinitions, wrapPlugin } from "./host-adapter.ts";

const z = tool.schema;

function tempTelemetry(): string {
  const dir = mkdtempSync(join(tmpdir(), "host-adapter-test-"));
  return join(dir, "lifecycle.jsonl");
}

const tempPaths: string[] = [];
function trackTemp(path: string): string {
  tempPaths.push(path);
  return path;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const p = tempPaths.pop();
    if (!p) continue;
    try {
      rmSync(p.replace(/\/lifecycle\.jsonl$/, ""), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

const stubInput = {
  client: {} as never,
  project: { id: "p", worktree: "/tmp", time: { created: 1 } } as never,
  directory: "/tmp",
  worktree: "/tmp",
  experimental_workspace: { register: () => {} } as never,
  serverUrl: new URL("http://localhost"),
  $: (() => {}) as never,
};

describe("validateToolDefinitions", () => {
  test("rejects codemem-style ZodObject args (the n._zod.def bug)", () => {
    const tools = {
      bad: {
        description: "bad tool",
        args: z.object({ x: z.string() }),
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("ZodObject");
    expect(result.errors[0]).toContain("plain object literal");
  });

  test("accepts correct ZodRawShape args", () => {
    const tools = {
      good: {
        description: "good tool",
        args: { x: z.string(), y: z.number().optional() },
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(true);
  });

  test("accepts empty args object (no parameters)", () => {
    const tools = {
      noargs: {
        description: "no args tool",
        args: {},
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(true);
  });

  test("rejects missing description", () => {
    const tools = {
      bad: {
        args: { x: z.string() },
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(false);
  });

  test("rejects missing execute", () => {
    const tools = {
      bad: {
        description: "missing execute",
        args: { x: z.string() },
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(false);
  });

  test("rejects undefined args", () => {
    const tools = {
      bad: {
        description: "no args field",
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(false);
  });

  test("rejects an arg that isn't a zod schema", () => {
    const tools = {
      bad: {
        description: "bad arg",
        args: { x: "not a schema" },
        execute: async () => "ok",
      },
    };
    const result = validateToolDefinitions(tools, "test-plugin");
    expect(result.ok).toBe(false);
  });
});

describe("wrapPlugin", () => {
  test("emits plugin.loaded telemetry on success", async () => {
    const path = trackTemp(tempTelemetry());
    const wrapped = wrapPlugin(
      async () => ({
        tool: {
          ping: {
            description: "ping",
            args: { msg: z.string() },
            execute: async () => "pong",
          },
        },
      }),
      { name: "test", telemetryPath: path },
    );

    await wrapped(stubInput);
    const content = readFileSync(path, "utf8");
    expect(content).toContain('"plugin.loaded"');
    expect(content).toContain('"test"');
    expect(content).toContain('"toolCount":1');
  });

  test("emits plugin.failed when plugin throws", async () => {
    const path = trackTemp(tempTelemetry());
    const wrapped = wrapPlugin(
      async () => {
        throw new Error("boom");
      },
      { name: "explosive", telemetryPath: path },
    );

    await expect(wrapped(stubInput)).rejects.toThrow("boom");
    const content = readFileSync(path, "utf8");
    expect(content).toContain('"plugin.failed"');
    expect(content).toContain('"boom"');
  });

  test("wraps tool execute so thrown errors return as strings", async () => {
    const path = trackTemp(tempTelemetry());
    const wrapped = wrapPlugin(
      async () => ({
        tool: {
          crash: {
            description: "always crashes",
            args: { msg: z.string() },
            execute: async () => {
              throw new Error("inside");
            },
          },
        },
      }),
      { name: "crashy", telemetryPath: path },
    );

    const hooks = await wrapped(stubInput);
    const crashTool = hooks.tool?.crash;
    if (!crashTool) throw new Error("expected crash tool to be registered");
    const result = await crashTool.execute({ msg: "hi" }, {} as never);
    expect(result).toContain("crashy");
    expect(result).toContain("crash");
    expect(result).toContain("inside");

    const content = readFileSync(path, "utf8");
    expect(content).toContain('"tool.failed"');
  });

  test("filters null/undefined out of system transform output", async () => {
    const path = trackTemp(tempTelemetry());
    const wrapped = wrapPlugin(
      async () => ({
        "experimental.chat.system.transform": async (_i: never, o: { system: string[] }) => {
          o.system.push(undefined as never);
          o.system.push(null as never);
          o.system.push("real entry");
          o.system.push("");
        },
      }),
      { name: "transformer", telemetryPath: path },
    );

    const hooks = await wrapped(stubInput);
    const transform = hooks["experimental.chat.system.transform"];
    if (!transform) throw new Error("expected transform hook to be registered");
    const out = { system: [] as string[] };
    await transform({ model: {} as never } as never, out);
    expect(out.system).toEqual(["real entry"]);
  });

  test("rejects codemem-style ZodObject args at registration", async () => {
    const path = trackTemp(tempTelemetry());
    const wrapped = wrapPlugin(
      async () => ({
        tool: {
          codemem_check: {
            description: "the codemem bug",
            args: z.object({ maxFindings: z.number() }),
            execute: async () => "ok",
          },
        },
      }),
      { name: "codemem-style", telemetryPath: path },
    );

    const hooks = await wrapped(stubInput);
    expect(hooks.tool ?? {}).toEqual({});
    const content = readFileSync(path, "utf8");
    expect(content).toContain("plugin.validation_failed");
    expect(content).toContain("ZodObject");
  });
});
