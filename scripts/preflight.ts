#!/usr/bin/env bun
/**
 * Preflight diagnostics for opencode plugin loading.
 *
 * Runs a battery of checks designed to catch every category of bug we have
 * actually hit in this repo:
 *
 *   1.  opencode.json plugin paths resolve to a real file or a non-empty cache.
 *   2.  No accidentally-fetched `opencode-conductor@latest` from npm
 *       (NocturnLabs' v1.0.6 collides with our local dev v0.1.0).
 *   3.  Each plugin's tool definitions pass validateToolDefinitions —
 *       this catches the codemem-style `args: z.object({...})` bug.
 *   4.  Each plugin's exported `default` is a function and returns a hooks
 *       object with valid tool definitions.
 *   5.  Worktree state DBs have no orphan OCX rows (launch_mode='ocx' AND
 *       ocx_bin IS NULL OR ocx_bin='undefined').
 *   6.  Engram sidecar (if present) passes PRAGMA quick_check.
 *   7.  Tool names are unique across all loaded plugins.
 *   8.  Engram sidecars are accessible (no permission/ENOENT issues).
 *
 * Exit codes:
 *   0  all checks passed
 *   1  one or more checks failed
 *   2  preflight itself encountered an error (config not loadable, etc.)
 *
 * Usage:
 *   bun run ~/.config/opencode/scripts/preflight.ts
 *   bun run ~/.config/opencode/scripts/preflight.ts --json    # machine-readable
 *   bun run ~/.config/opencode/scripts/preflight.ts --quiet   # only failures
 */

import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { validateToolDefinitions } from "../plugin/_host/host-adapter.ts";

const CONFIG_ROOT = "/Users/jack.mazac/.config/opencode";
const FLEET_MANIFEST = join(CONFIG_ROOT, "fleet.jsonc");
const CACHE_ROOT = join(homedir(), ".cache", "opencode", "packages");
const WORKTREE_DBS_DIR = join(homedir(), ".local", "share", "opencode", "plugins", "worktree");

type CheckResult = {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  details?: unknown;
};

type FleetManifest = {
  plugins?: Array<{
    name?: unknown;
    enabled?: unknown;
    plugin_ref?: unknown;
  }>;
};

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const quiet = args.includes("--quiet");

const results: CheckResult[] = [];

async function main(): Promise<void> {
  await checkOpencodeJsonPluginPaths();
  await checkNoStaleConductorCache();
  await checkPluginToolDefinitions();
  await checkWorktreeStateDbs();
  await checkEngramSidecar();
  await checkOpencodePluginVersionConsistency();
  await checkUniqueToolNames();

  emitResults();
  const failed = results.filter((r) => r.status === "fail");
  process.exit(failed.length === 0 ? 0 : 1);
}

async function checkOpencodeJsonPluginPaths(): Promise<void> {
  const configPath = join(CONFIG_ROOT, "opencode.json");
  if (!existsSync(configPath)) {
    results.push({
      name: "opencode.json exists",
      status: "fail",
      message: `not found: ${configPath}`,
    });
    return;
  }

  let raw: { plugin?: unknown[] };
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    results.push({
      name: "opencode.json parses",
      status: "fail",
      message: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  if (!Array.isArray(raw.plugin)) {
    results.push({
      name: "opencode.json has plugin array",
      status: "fail",
      message: `expected array at .plugin, got ${typeof raw.plugin}`,
    });
    return;
  }

  for (const entry of raw.plugin) {
    if (typeof entry !== "string") {
      results.push({
        name: `plugin ref is string`,
        status: "fail",
        message: `entry is not a string: ${JSON.stringify(entry)}`,
      });
      continue;
    }

    if (entry.startsWith("file://")) {
      const path = fileURLToPath(entry);
      if (existsSync(path)) {
        results.push({ name: `file:// ref resolves`, status: "pass", message: entry });
      } else {
        results.push({
          name: `file:// ref resolves`,
          status: "fail",
          message: `path does not exist: ${path} (from ${entry})`,
        });
      }
      continue;
    }

    const cacheVariants = [
      join(CACHE_ROOT, `${entry}@latest`),
      join(CACHE_ROOT, entry),
      join(CACHE_ROOT, `${entry.replace(/@latest$/, "")}@latest`),
    ];
    const cached = cacheVariants.find((p) => existsSync(p) && readdirSync(p).length > 0);
    if (cached) {
      results.push({ name: `npm ref ${entry}`, status: "pass", message: cached });
    } else {
      results.push({
        name: `npm ref ${entry}`,
        status: "warn",
        message: `not in opencode cache yet (will fetch on next launch): ${cacheVariants[0]}`,
      });
    }
  }
}

async function checkNoStaleConductorCache(): Promise<void> {
  const cached = join(CACHE_ROOT, "opencode-conductor@latest");
  if (!existsSync(cached)) {
    results.push({
      name: "no stale opencode-conductor cache",
      status: "pass",
      message: "(none)",
    });
    return;
  }

  const inner = join(cached, "node_modules", "opencode-conductor", "package.json");
  let version = "unknown";
  if (existsSync(inner)) {
    try {
      version = JSON.parse(readFileSync(inner, "utf8")).version ?? "unknown";
    } catch {
      // ignore
    }
  }

  results.push({
    name: "no stale opencode-conductor cache",
    status: "fail",
    message: `${cached} (version: ${version}) — this is NocturnLabs' v1.0.6, NOT your local dev tree. Quarantine with: mv ${cached} ${cached}.quarantine`,
  });
}

async function checkPluginToolDefinitions(): Promise<void> {
  const plugins = await collectLocalPluginPaths();
  for (const { name, path } of plugins) {
    let mod: Record<string, unknown>;
    try {
      mod = await import(path);
    } catch (error) {
      results.push({
        name: `plugin ${name} imports`,
        status: "fail",
        message: `${path}: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const factory = mod.default;
    if (typeof factory !== "function") {
      results.push({
        name: `plugin ${name} default is function`,
        status: "fail",
        message: `default export type=${typeof factory}`,
      });
      continue;
    }

    let hooks: { tool?: Record<string, unknown> };
    try {
      hooks = await factory(stubInput(), {});
    } catch (error) {
      results.push({
        name: `plugin ${name} factory runs`,
        status: "warn",
        message: `factory threw (may need real input): ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (!hooks || typeof hooks !== "object") {
      results.push({
        name: `plugin ${name} returns hooks object`,
        status: "fail",
        message: `factory returned ${typeof hooks}`,
      });
      continue;
    }

    const validation = validateToolDefinitions(hooks.tool, name);
    if (validation.ok) {
      results.push({
        name: `plugin ${name} tool definitions valid`,
        status: "pass",
        message: `${Object.keys(hooks.tool ?? {}).length} tools`,
      });
    } else {
      results.push({
        name: `plugin ${name} tool definitions valid`,
        status: "fail",
        message: validation.errors.join(" | "),
        details: validation.errors,
      });
    }
  }
}

async function collectLocalPluginPaths(): Promise<Array<{ name: string; path: string }>> {
  const manifestPlugins = collectFleetManifestPluginPaths();
  if (manifestPlugins.length > 0) return manifestPlugins;

  const configPath = join(CONFIG_ROOT, "opencode.json");
  let raw: { plugin?: unknown[] };
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return [];
  }
  const out: Array<{ name: string; path: string }> = [];
  for (const entry of raw.plugin ?? []) {
    if (typeof entry !== "string") continue;
    if (!entry.startsWith("file://")) continue;
    const path = fileURLToPath(entry);
    if (!existsSync(path)) continue;
    const name = inferPluginName(path);
    out.push({ name, path });
  }
  return out;
}

function collectFleetManifestPluginPaths(): Array<{ name: string; path: string }> {
  if (!existsSync(FLEET_MANIFEST)) return [];
  let manifest: FleetManifest;
  try {
    manifest = parseJsonc(readFileSync(FLEET_MANIFEST, "utf8")) as FleetManifest;
  } catch {
    return [];
  }

  const out: Array<{ name: string; path: string }> = [];
  for (const plugin of manifest.plugins ?? []) {
    if (plugin.enabled === false) continue;
    if (typeof plugin.plugin_ref !== "string") continue;
    if (!plugin.plugin_ref.startsWith("file://")) continue;
    const path = pluginRefToPath(plugin.plugin_ref);
    if (!existsSync(path)) continue;
    const name = typeof plugin.name === "string" ? plugin.name : inferPluginName(path);
    out.push({ name, path });
  }
  return out;
}

function pluginRefToPath(ref: string): string {
  if (ref.startsWith("file://~/")) return join(homedir(), ref.slice("file://~/".length));
  if (ref.startsWith("file://~")) return join(homedir(), ref.slice("file://~".length));
  return fileURLToPath(ref);
}

function inferPluginName(path: string): string {
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
    project: { id: "preflight-stub", worktree: "/tmp", time: { created: 1 } },
    directory: "/tmp",
    worktree: "/tmp",
    experimental_workspace: { register: () => {} },
    serverUrl: new URL("http://localhost:0"),
    $: () => {},
  };
}

async function checkWorktreeStateDbs(): Promise<void> {
  if (!existsSync(WORKTREE_DBS_DIR)) {
    results.push({ name: "worktree state DBs", status: "skip", message: "no worktree state dir" });
    return;
  }

  const files = readdirSync(WORKTREE_DBS_DIR).filter((f) => f.endsWith(".sqlite"));
  for (const file of files) {
    const path = join(WORKTREE_DBS_DIR, file);
    let db: Database | undefined;
    try {
      db = new Database(path, { readonly: true });
      const orphans = db
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM sessions
           WHERE launch_mode = 'ocx'
             AND (ocx_bin IS NULL OR ocx_bin = '' OR ocx_bin = 'undefined' OR profile IS NULL OR profile = '' OR profile = 'undefined')`,
        )
        .get();
      if (!orphans || orphans.count === 0) {
        results.push({ name: `worktree ${file}`, status: "pass", message: "no orphan OCX rows" });
      } else {
        results.push({
          name: `worktree ${file}`,
          status: "fail",
          message: `${orphans.count} orphan OCX rows (launch_mode=ocx with null/empty/undefined ocx_bin or profile)`,
        });
      }
    } catch (error) {
      results.push({
        name: `worktree ${file}`,
        status: "warn",
        message: `could not query: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      db?.close();
    }
  }
}

async function checkEngramSidecar(): Promise<void> {
  const sidecar = join(CONFIG_ROOT, ".opencode", "memory.db");
  if (!existsSync(sidecar)) {
    results.push({ name: "engram sidecar", status: "skip", message: "no sidecar at " + sidecar });
    return;
  }

  let db: Database | undefined;
  try {
    db = new Database(sidecar, { readonly: true });
    const result = db.query<{ quick_check: string }, []>("PRAGMA quick_check;").get();
    if (result?.quick_check === "ok") {
      const sizeBytes = statSync(sidecar).size;
      results.push({
        name: "engram sidecar quick_check",
        status: "pass",
        message: `ok (${(sizeBytes / 1024).toFixed(1)} KB)`,
      });
    } else {
      results.push({
        name: "engram sidecar quick_check",
        status: "fail",
        message: result?.quick_check ?? "no result returned",
      });
    }
  } catch (error) {
    results.push({
      name: "engram sidecar quick_check",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    db?.close();
  }
}

async function checkOpencodePluginVersionConsistency(): Promise<void> {
  const hostVersion = readVersion(
    join(CONFIG_ROOT, "node_modules", "@opencode-ai", "plugin", "package.json"),
  );
  if (!hostVersion) {
    results.push({
      name: "@opencode-ai/plugin host version",
      status: "warn",
      message: "could not read host version",
    });
    return;
  }
  results.push({
    name: "@opencode-ai/plugin host version",
    status: "pass",
    message: hostVersion,
  });

  const pluginRepos = [
    {
      name: "engram",
      path: "/Users/jack.mazac/Developer/engram/node_modules/@opencode-ai/plugin/package.json",
    },
    {
      name: "conductor",
      path: "/Users/jack.mazac/Developer/opencode-conductor/node_modules/@opencode-ai/plugin/package.json",
    },
    {
      name: "codemem",
      path: "/Users/jack.mazac/Developer/codemem/node_modules/@opencode-ai/plugin/package.json",
    },
  ];

  for (const { name, path } of pluginRepos) {
    if (!existsSync(path)) {
      results.push({
        name: `${name} @opencode-ai/plugin`,
        status: "skip",
        message: `not installed: ${path}`,
      });
      continue;
    }
    const v = readVersion(path);
    if (v === hostVersion) {
      results.push({ name: `${name} @opencode-ai/plugin`, status: "pass", message: v ?? "" });
    } else {
      results.push({
        name: `${name} @opencode-ai/plugin`,
        status: "warn",
        message: `${v} (host: ${hostVersion}) — mismatch may produce subtle bugs`,
      });
    }
  }
}

function readVersion(packageJsonPath: string): string | undefined {
  if (!existsSync(packageJsonPath)) return undefined;
  try {
    const json = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return typeof json.version === "string" ? json.version : undefined;
  } catch {
    return undefined;
  }
}

async function checkUniqueToolNames(): Promise<void> {
  const plugins = await collectLocalPluginPaths();
  const seen = new Map<string, string[]>();
  for (const { name, path } of plugins) {
    let mod: Record<string, unknown>;
    try {
      mod = await import(path);
    } catch {
      continue;
    }
    const factory = mod.default;
    if (typeof factory !== "function") continue;
    let hooks: { tool?: Record<string, unknown> };
    try {
      hooks = await factory(stubInput(), {});
    } catch {
      continue;
    }
    for (const tool of Object.keys(hooks?.tool ?? {})) {
      const owners = seen.get(tool) ?? [];
      owners.push(name);
      seen.set(tool, owners);
    }
  }

  const collisions: string[] = [];
  for (const [tool, owners] of seen.entries()) {
    if (owners.length > 1) {
      collisions.push(`${tool} → ${owners.join(", ")}`);
    }
  }

  if (collisions.length === 0) {
    results.push({
      name: "tool name uniqueness",
      status: "pass",
      message: `${seen.size} tools across ${plugins.length} local plugins, no collisions`,
    });
  } else {
    results.push({
      name: "tool name uniqueness",
      status: "fail",
      message: collisions.join(" | "),
    });
  }
}

function emitResults(): void {
  if (wantJson) {
    process.stdout.write(JSON.stringify({ results, summary: summarize() }, null, 2) + "\n");
    return;
  }

  const colors = {
    pass: "\x1b[32m",
    fail: "\x1b[31m",
    warn: "\x1b[33m",
    skip: "\x1b[90m",
    reset: "\x1b[0m",
  };

  const filtered = quiet ? results.filter((r) => r.status === "fail") : results;
  for (const r of filtered) {
    const tag = `[${r.status.padEnd(4)}]`;
    process.stdout.write(`${colors[r.status]}${tag}${colors.reset} ${r.name}: ${r.message}\n`);
  }

  const s = summarize();
  process.stdout.write(`\n${s.pass} pass, ${s.fail} fail, ${s.warn} warn, ${s.skip} skip\n`);
}

function summarize() {
  return {
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    warn: results.filter((r) => r.status === "warn").length,
    skip: results.filter((r) => r.status === "skip").length,
  };
}

main().catch((error) => {
  process.stderr.write(
    `preflight crashed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exit(2);
});
