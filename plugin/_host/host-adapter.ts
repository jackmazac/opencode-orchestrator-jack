/**
 * Local re-export of the host adapter from the published package.
 *
 * The implementation lives in @jackmazac/opencode-host-adapter (source at
 * /Users/jack.mazac/Developer/opencode-host-adapter/). This file exists for
 * historical compatibility with imports already in this repo.
 *
 * Prefer importing directly from "@jackmazac/opencode-host-adapter" in new code.
 */

export {
  argDigest,
  emit,
  errorPayload,
  looksLikeZodSchema,
  resolveTelemetryPath,
  validateToolDefinition,
  validateToolDefinitions,
  wrapPlugin,
} from "@jackmazac/opencode-host-adapter";

export type {
  Hooks,
  Plugin,
  PluginInput,
  PluginOptions,
  ToolDefinitionResolved,
  ToolLike,
  ToolValidationResult,
  WrapOptions,
} from "@jackmazac/opencode-host-adapter";
