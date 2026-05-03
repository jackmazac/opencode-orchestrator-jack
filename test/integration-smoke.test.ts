/**
 * Cross-plugin integration smoke test.
 *
 * Loads every locally-developed plugin currently configured in opencode.json
 * and asserts:
 *
 *   - Each plugin module imports without throwing.
 *   - Each plugin's default export is a function (a Plugin factory).
 *   - The factory returns a hooks object passing validateToolDefinitions.
 *   - No tool name collisions across all plugins.
 *
 * Detects the same class of bugs preflight catches, but in a real test
 * runner so it can run in CI and pre-commit hooks.
 *
 * Run:
 *   cd ~/.config/opencode && bun test test/integration-smoke.test.ts
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateToolDefinitions } from "@jackmazac/opencode-host-adapter";

const CONFIG_PATH = "/Users/jack.mazac/.config/opencode/opencode.json";

type LocalPlugin = { name: string; path: string };

function collectLocalPlugins(): LocalPlugin[] {
  if (!existsSync(CONFIG_PATH)) return [];
  const config: { plugin?: unknown[] } = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const out: LocalPlugin[] = [];
  for (const entry of config.plugin ?? []) {
    if (typeof entry !== "string") continue;
    if (!entry.startsWith("file://")) continue;
    const path = fileURLToPath(entry);
    if (!existsSync(path)) continue;
    out.push({ name: inferName(path), path });
  }
  return out;
}

function inferName(path: string): string {
  if (path.includes("/engram/")) return "engram";
  if (path.includes("/opencode-conductor/")) return "conductor";
  if (path.includes("/codemem/") || path.includes("/@codemem/")) return "codemem";
  if (path.endsWith("/worktree.ts")) return "worktree";
  if (path.endsWith("/context-usage.ts")) return "context-usage";
  return path.split("/").slice(-2).join("/");
}

function stubInput(): unknown {
  return {
    client: { app: { log: async () => {} } },
    project: { id: "smoke-stub", worktree: "/tmp", time: { created: 1 } },
    directory: "/tmp",
    worktree: "/tmp",
    experimental_workspace: { register: () => {} },
    serverUrl: new URL("http://localhost:0"),
    $: () => {},
  };
}

const plugins = collectLocalPlugins();

describe("cross-plugin integration smoke", () => {
  test("opencode.json contains at least one local plugin", () => {
    expect(plugins.length).toBeGreaterThan(0);
  });

  for (const { name, path } of plugins) {
    test(`${name} imports cleanly`, async () => {
      await expect(import(path)).resolves.toBeDefined();
    });

    test(`${name} default export is a function`, async () => {
      const mod = await import(path);
      const factory = (mod as Record<string, unknown>).default;
      expect(typeof factory).toBe("function");
    });

    test(`${name} factory returns valid tool definitions`, async () => {
      const mod = await import(path);
      const factoryRaw = (mod as Record<string, unknown>).default;
      if (typeof factoryRaw !== "function") return;
      const factory = factoryRaw as (input: unknown, options?: unknown) => Promise<{ tool?: unknown }>;
      const hooks = await factory(stubInput(), {});
      const validation = validateToolDefinitions(hooks?.tool, name);
      if (!validation.ok) {
        throw new Error(`${name} tool validation failed:\n  ${validation.errors.join("\n  ")}`);
      }
    });
  }

  test("no tool name collisions across all plugins", async () => {
    const seen = new Map<string, string[]>();
    for (const { name, path } of plugins) {
      const mod = await import(path);
      const factoryRaw = (mod as Record<string, unknown>).default;
      if (typeof factoryRaw !== "function") continue;
      const factory = factoryRaw as (input: unknown, options?: unknown) => Promise<{ tool?: Record<string, unknown> }>;
      let hooks: { tool?: Record<string, unknown> };
      try {
        hooks = await factory(stubInput(), {});
      } catch {
        continue;
      }
      for (const toolName of Object.keys(hooks?.tool ?? {})) {
        const owners = seen.get(toolName) ?? [];
        owners.push(name);
        seen.set(toolName, owners);
      }
    }
    const collisions: string[] = [];
    for (const [toolName, owners] of seen.entries()) {
      if (owners.length > 1) collisions.push(`${toolName} → ${owners.join(", ")}`);
    }
    if (collisions.length > 0) {
      throw new Error(`tool name collisions detected:\n  ${collisions.join("\n  ")}`);
    }
    expect(collisions.length).toBe(0);
  });
});
