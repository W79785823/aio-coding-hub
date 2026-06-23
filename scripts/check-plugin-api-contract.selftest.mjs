import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(root, path, value) {
  writeFileSync(join(root, path), JSON.stringify(value, null, 2));
}

function makeRoot(name) {
  const root = join(tmpdir(), `aio-plugin-contract-${name}-${Date.now()}`);
  mkdirSync(join(root, "docs/plugins"), { recursive: true });
  mkdirSync(join(root, "docs/plugins/reference"), { recursive: true });
  mkdirSync(join(root, "docs/plugins/runtime"), { recursive: true });
  mkdirSync(join(root, "packages/plugin-sdk/src"), { recursive: true });
  mkdirSync(join(root, "packages/plugin-wasm-sdk/src"), { recursive: true });
  mkdirSync(join(root, "packages/create-aio-plugin/src"), { recursive: true });
  mkdirSync(join(root, "src-tauri/src/domain"), { recursive: true });
  mkdirSync(join(root, "src-tauri/src/gateway/plugins"), { recursive: true });
  return root;
}

function runCheck(root) {
  return spawnSync("node", ["scripts/check-plugin-api-contract.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, AIO_PLUGIN_CONTRACT_TEST_ROOT: root },
    encoding: "utf8",
  });
}

function writePassingDevtools(root) {
  writeFileSync(
    join(root, "packages/create-aio-plugin/src/devtools.ts"),
    [
      [
        "gateway.request.afterBodyRead",
        "gateway.request.beforeSend",
        "gateway.response.chunk",
        "gateway.response.after",
        "gateway.error",
        "log.beforePersist",
      ].join(" "),
      [
        "request.body.read",
        "request.body.write",
        "response.body.read",
        "response.body.write",
        "stream.inspect",
        "stream.modify",
        "log.redact",
      ].join(" "),
      "requestBody responseBody streamChunk logMessage headers",
      "declarativeRules wasm",
      "PLUGIN_RULE_PERMISSION_MISMATCH PLUGIN_REPLAY_UNSUPPORTED_RUNTIME PLUGIN_WASM_POLICY_GATED",
      "validatePluginFilesStrict replayHookExplain doctorPluginFiles",
    ].join("\n")
  );
}

function writePassingScaffold(root) {
  writeFileSync(
    join(root, "packages/plugin-sdk/src/index.ts"),
    [
      [
        "gateway.request.afterBodyRead",
        "gateway.request.beforeSend",
        "gateway.response.chunk",
        "gateway.response.after",
        "gateway.error",
        "log.beforePersist",
        "gateway.response.headers",
      ].join(" "),
      [
        "request.meta.read",
        "request.header.read",
        "request.header.readSensitive",
        "request.header.write",
        "request.body.read",
        "request.body.write",
        "response.header.read",
        "response.header.write",
        "response.body.read",
        "response.body.write",
        "stream.inspect",
        "stream.modify",
        "log.redact",
        "network.fetch",
      ].join(" "),
      "requestBody responseBody streamChunk logMessage headers",
      "declarativeRules wasm",
      [
        "export type ActiveGatewayHookName =",
        "'gateway.request.afterBodyRead' |",
        "'gateway.request.beforeSend' |",
        "'gateway.response.chunk' |",
        "'gateway.response.after' |",
        "'gateway.error' |",
        "'log.beforePersist';",
      ].join(" "),
      "export type ReservedGatewayHookName = 'gateway.response.headers';",
      "export type GatewayHookName = ActiveGatewayHookName | ReservedGatewayHookName;",
      "type PluginManifest = { permissions: string[]; hooks: { name: string }[] };",
      "function validateManifest(manifest: PluginManifest) {",
      "  return validatePermissionSet(manifest);",
      "}",
      "function validatePermissionSet(manifest: PluginManifest) {",
      "  const set = new Set(manifest.permissions);",
      "  const hooks = new Set(manifest.hooks.map((hook) => hook.name));",
      "  if (hooks.has('gateway.request.afterBodyRead') && set.has('request.body.write') && !set.has('request.body.read')) return 'request.body.write requires request.body.read';",
      "  if (hooks.has('gateway.response.after') && set.has('response.body.write') && !set.has('response.body.read')) return 'response.body.write requires response.body.read';",
      "  if (hooks.has('gateway.response.chunk') && set.has('stream.modify') && !set.has('stream.inspect')) return 'stream.modify requires stream.inspect';",
      "  return null;",
      "}",
    ].join("\n")
  );
  writeFileSync(
    join(root, "packages/create-aio-plugin/src/scaffold.ts"),
    [
      "declarativeRules wasm gateway.request.afterBodyRead gateway.request.beforeSend",
      "request.body.read request.body.write",
    ].join("\n")
  );
  writeFileSync(
    join(root, "src-tauri/src/gateway/plugins/contract.rs"),
    [
      "gateway.request.afterBodyRead gateway.request.beforeSend gateway.response.headers",
      "request.body.read request.body.write network.fetch",
    ].join("\n")
  );
  writeFileSync(
    join(root, "src-tauri/src/domain/plugins.rs"),
    [
      "declarativeRules wasm native privacyFilter",
      "crate::gateway::plugins::contract::is_active_hook",
      "crate::gateway::plugins::contract::is_reserved_hook",
      "crate::gateway::plugins::contract::is_reserved_permission",
      "crate::gateway::plugins::contract::hook_contract",
      "pub fn is_active_gateway_hook(hook: &str) -> bool {",
      '  hook == "gateway.request.afterBodyRead" || hook == "gateway.request.beforeSend"',
      "}",
      'pub fn is_reserved_gateway_hook(hook: &str) -> bool { hook == "gateway.response.headers" }',
      'pub fn is_reserved_permission(permission: &str) -> bool { permission == "network.fetch" }',
      "fn permission_risk(permission: &str) { request.body.read; request.body.write; network.fetch; }",
      "PLUGIN_RESERVED_HOOK PLUGIN_RESERVED_PERMISSION",
    ].join("\n")
  );
  writeFileSync(
    join(root, "src-tauri/src/gateway/plugins/pipeline.rs"),
    "Duration::from_millis(150) FailurePolicy::FailOpen"
  );
  writeFileSync(
    join(root, "docs/plugin-manifest-v1.md"),
    [
      "gateway.request.afterBodyRead gateway.request.beforeSend gateway.response.headers",
      "request.body.read request.body.write network.fetch",
    ].join("\n")
  );
  writeFileSync(
    join(root, "docs/plugins/reference/hooks.md"),
    "gateway.request.afterBodyRead gateway.request.beforeSend gateway.response.headers"
  );
  writeFileSync(
    join(root, "docs/plugins/reference/permissions.md"),
    "request.body.read request.body.write network.fetch"
  );
  writeFileSync(
    join(root, "docs/plugins/reference/manifest.md"),
    "declarativeRules wasm native privacyFilter"
  );
  writeFileSync(join(root, "docs/plugins/runtime/wasm.md"), "wasm PLUGIN_RUNTIME_DISABLED");
  writeFileSync(
    join(root, "packages/plugin-wasm-sdk/src/lib.rs"),
    'request_body #[serde(rename_all = "camelCase")]'
  );
  writePassingDevtools(root);
}

const reservedHookRoot = makeRoot("reserved-hook");
writeJson(reservedHookRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read"],
  reservedPermissions: ["network.fetch"],
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writeFileSync(
  join(reservedHookRoot, "packages/plugin-sdk/src/index.ts"),
  "gateway.request.afterBodyRead request.body.read declarativeRules"
);
writeFileSync(
  join(reservedHookRoot, "packages/create-aio-plugin/src/scaffold.ts"),
  "declarativeRules gateway.request.afterBodyRead request.body.read"
);
writeFileSync(
  join(reservedHookRoot, "src-tauri/src/domain/plugins.rs"),
  "gateway.request.afterBodyRead request.body.read declarativeRules"
);
writeFileSync(
  join(reservedHookRoot, "docs/plugin-manifest-v1.md"),
  "gateway.request.afterBodyRead request.body.read"
);
writeFileSync(
  join(reservedHookRoot, "docs/plugins/reference/hooks.md"),
  "gateway.request.afterBodyRead"
);
writeFileSync(join(reservedHookRoot, "docs/plugins/reference/permissions.md"), "request.body.read");
writeFileSync(
  join(reservedHookRoot, "docs/plugins/reference/manifest.md"),
  "declarativeRules wasm native privacyFilter"
);
writeFileSync(
  join(reservedHookRoot, "docs/plugins/runtime/wasm.md"),
  "wasm PLUGIN_RUNTIME_DISABLED"
);

const reservedHookResult = runCheck(reservedHookRoot);
if (
  reservedHookResult.status === 0 ||
  !reservedHookResult.stderr.includes("gateway.response.headers")
) {
  throw new Error(
    `expected structural contract failure, got status ${reservedHookResult.status}\n${reservedHookResult.stderr}`
  );
}

const missingHookMetadataRoot = makeRoot("missing-hook-metadata");
writeJson(missingHookMetadataRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      readPermissions: ["request.body.read"],
      writePermissions: [],
      contextFields: ["traceId"],
      timeoutMs: 150,
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(missingHookMetadataRoot);

const missingHookMetadataResult = runCheck(missingHookMetadataRoot);
if (
  missingHookMetadataResult.status === 0 ||
  !missingHookMetadataResult.stderr.includes("hookMatrix.gateway.request.afterBodyRead.kind") ||
  !missingHookMetadataResult.stderr.includes("hookMatrix.gateway.request.afterBodyRead.status") ||
  !missingHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.permissionDependencies"
  ) ||
  !missingHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.mutationFields"
  )
) {
  throw new Error(
    `expected hookMatrix metadata failure, got status ${missingHookMetadataResult.status}\n${missingHookMetadataResult.stderr}`
  );
}

const inconsistentHookMetadataRoot = makeRoot("inconsistent-hook-metadata");
writeJson(inconsistentHookMetadataRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      kind: "request",
      status: "reserved",
      defaultFailurePolicy: "fail-closed",
      timeoutMs: 150,
      reservedHeaderPolicy: "allow-all",
      readPermissions: ["request.body.read"],
      writePermissions: [],
      mutationFields: ["requestBody"],
      contextFields: ["traceId"],
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(inconsistentHookMetadataRoot);

const inconsistentHookMetadataResult = runCheck(inconsistentHookMetadataRoot);
if (
  inconsistentHookMetadataResult.status === 0 ||
  !inconsistentHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.status must be active"
  ) ||
  !inconsistentHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.defaultFailurePolicy must equal defaultFailurePolicy"
  ) ||
  !inconsistentHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.reservedHeaderPolicy must be one of block-gateway-owned"
  )
) {
  throw new Error(
    `expected hookMatrix consistency failure, got status ${inconsistentHookMetadataResult.status}\n${inconsistentHookMetadataResult.stderr}`
  );
}

const duplicateHookMetadataRoot = makeRoot("duplicate-hook-metadata");
writeJson(duplicateHookMetadataRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      kind: "request",
      status: "active",
      defaultFailurePolicy: "fail-open",
      timeoutMs: 150,
      reservedHeaderPolicy: "block-gateway-owned",
      readPermissions: ["request.body.read", "request.body.read"],
      writePermissions: [],
      permissionDependencies: {},
      mutationFields: ["requestBody"],
      contextFields: ["traceId"],
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(duplicateHookMetadataRoot);

const duplicateHookMetadataResult = runCheck(duplicateHookMetadataRoot);
if (
  duplicateHookMetadataResult.status === 0 ||
  !duplicateHookMetadataResult.stderr.includes(
    "hookMatrix.gateway.request.afterBodyRead.readPermissions contains duplicate request.body.read"
  )
) {
  throw new Error(
    `expected hookMatrix duplicate metadata failure, got status ${duplicateHookMetadataResult.status}\n${duplicateHookMetadataResult.stderr}`
  );
}

const missingDevtoolsMetadataRoot = makeRoot("missing-devtools-metadata");
writeJson(missingDevtoolsMetadataRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read", "request.body.write"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      kind: "request",
      status: "active",
      defaultFailurePolicy: "fail-open",
      timeoutMs: 150,
      reservedHeaderPolicy: "block-gateway-owned",
      readPermissions: ["request.body.read"],
      writePermissions: ["request.body.write"],
      permissionDependencies: { "request.body.write": ["request.body.read"] },
      mutationFields: ["requestBody"],
      contextFields: ["traceId"],
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(missingDevtoolsMetadataRoot);
writeFileSync(
  join(missingDevtoolsMetadataRoot, "packages/create-aio-plugin/src/devtools.ts"),
  "declarativeRules validatePluginFilesStrict replayHookExplain doctorPluginFiles"
);

const missingDevtoolsMetadataResult = runCheck(missingDevtoolsMetadataRoot);
if (
  missingDevtoolsMetadataResult.status === 0 ||
  !missingDevtoolsMetadataResult.stderr.includes("packages/create-aio-plugin/src/devtools.ts") ||
  !missingDevtoolsMetadataResult.stderr.includes("requestBody")
) {
  throw new Error(
    `expected devtools metadata failure, got status ${missingDevtoolsMetadataResult.status}\n${missingDevtoolsMetadataResult.stderr}`
  );
}

const partialDevtoolsMetadataRoot = makeRoot("partial-devtools-metadata");
writeJson(partialDevtoolsMetadataRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody", "headers"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.meta.read", "request.body.read"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      kind: "request",
      status: "active",
      defaultFailurePolicy: "fail-open",
      timeoutMs: 150,
      reservedHeaderPolicy: "block-gateway-owned",
      readPermissions: ["request.meta.read", "request.body.read"],
      writePermissions: [],
      permissionDependencies: {},
      mutationFields: ["requestBody", "headers"],
      contextFields: ["traceId", "request.body"],
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(partialDevtoolsMetadataRoot);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "src-tauri/src/gateway/plugins/contract.rs"),
  [
    "gateway.request.afterBodyRead gateway.response.headers",
    "request.meta.read request.body.read network.fetch",
  ].join("\n")
);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "src-tauri/src/domain/plugins.rs"),
  [
    "declarativeRules wasm native privacyFilter",
    "crate::gateway::plugins::contract::is_active_hook",
    "crate::gateway::plugins::contract::is_reserved_hook",
    "crate::gateway::plugins::contract::is_reserved_permission",
    "crate::gateway::plugins::contract::hook_contract",
    "pub fn is_active_gateway_hook(hook: &str) -> bool {",
    '  hook == "gateway.request.afterBodyRead"',
    "}",
    'pub fn is_reserved_gateway_hook(hook: &str) -> bool { hook == "gateway.response.headers" }',
    'pub fn is_reserved_permission(permission: &str) -> bool { permission == "network.fetch" }',
    "fn permission_risk(permission: &str) { request.meta.read; request.body.read; network.fetch; }",
    "PLUGIN_RESERVED_HOOK PLUGIN_RESERVED_PERMISSION",
  ].join("\n")
);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "docs/plugin-manifest-v1.md"),
  "gateway.request.afterBodyRead gateway.response.headers request.meta.read request.body.read network.fetch"
);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "docs/plugins/reference/permissions.md"),
  "request.meta.read request.body.read network.fetch"
);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "packages/plugin-wasm-sdk/src/lib.rs"),
  'request_body headers #[serde(rename_all = "camelCase")]'
);
writeFileSync(
  join(partialDevtoolsMetadataRoot, "packages/create-aio-plugin/src/devtools.ts"),
  [
    "gateway.request.afterBodyRead",
    "request.body.read",
    "requestBody",
    "declarativeRules wasm",
    "PLUGIN_RULE_PERMISSION_MISMATCH PLUGIN_REPLAY_UNSUPPORTED_RUNTIME PLUGIN_WASM_POLICY_GATED",
    "validatePluginFilesStrict replayHookExplain doctorPluginFiles",
  ].join("\n")
);

const partialDevtoolsMetadataResult = runCheck(partialDevtoolsMetadataRoot);
if (
  partialDevtoolsMetadataResult.status === 0 ||
  !partialDevtoolsMetadataResult.stderr.includes(
    "packages/create-aio-plugin/src/devtools.ts is missing developer tool active permission request.meta.read"
  ) ||
  !partialDevtoolsMetadataResult.stderr.includes(
    "packages/create-aio-plugin/src/devtools.ts is missing developer tool mutation field headers"
  )
) {
  throw new Error(
    `expected full devtools metadata failure, got status ${partialDevtoolsMetadataResult.status}\n${partialDevtoolsMetadataResult.stderr}`
  );
}

const globalPermissionDependencyRoot = makeRoot("global-permission-dependency");
writeJson(globalPermissionDependencyRoot, "docs/plugins/plugin-api-v1-contract.json", {
  apiVersion: "1.0.0",
  defaultHookTimeoutMs: 150,
  defaultFailurePolicy: "fail-open",
  activeHooks: ["gateway.request.afterBodyRead", "gateway.request.beforeSend"],
  reservedHooks: ["gateway.response.headers"],
  activeMutationFields: ["requestBody"],
  configSchemaTypes: ["object"],
  activePermissions: ["request.body.read", "request.body.write"],
  reservedPermissions: ["network.fetch"],
  hookMatrix: {
    "gateway.request.afterBodyRead": {
      phase: "after request body read and before upstream provider send",
      kind: "request",
      status: "active",
      defaultFailurePolicy: "fail-open",
      timeoutMs: 150,
      reservedHeaderPolicy: "block-gateway-owned",
      readPermissions: ["request.body.read"],
      writePermissions: ["request.body.write"],
      permissionDependencies: {
        "request.body.write": ["request.body.read"],
      },
      mutationFields: ["requestBody"],
      contextFields: ["traceId", "request.body"],
    },
    "gateway.request.beforeSend": {
      phase: "after provider resolution and before upstream provider send",
      kind: "request",
      status: "active",
      defaultFailurePolicy: "fail-open",
      timeoutMs: 150,
      reservedHeaderPolicy: "block-gateway-owned",
      readPermissions: ["request.body.read"],
      writePermissions: ["request.body.write"],
      permissionDependencies: {},
      mutationFields: ["requestBody"],
      contextFields: ["traceId", "request.body"],
    },
  },
  communityRuntimes: ["declarativeRules"],
  policyGatedRuntimes: ["wasm"],
  officialRuntimes: ["native:privacyFilter"],
});
writePassingScaffold(globalPermissionDependencyRoot);
writeFileSync(
  join(globalPermissionDependencyRoot, "packages/plugin-sdk/src/index.ts"),
  [
    "export type PluginPermission = 'request.body.read' | 'request.body.write' | 'network.fetch';",
    "export type ActiveGatewayHookName = 'gateway.request.afterBodyRead' | 'gateway.request.beforeSend';",
    "export type ReservedGatewayHookName = 'gateway.response.headers';",
    "export type GatewayHookName = ActiveGatewayHookName | ReservedGatewayHookName;",
    "const runtimeTokens = 'declarativeRules wasm';",
    "const activeMutationField = 'requestBody';",
    "function validateManifest(manifest: { permissions: PluginPermission[] }) {",
    "  return validatePermissionSet(manifest.permissions);",
    "}",
    "function validatePermissionSet(permissions: PluginPermission[]) {",
    "  const set = new Set(permissions);",
    "  if (set.has('request.body.write') && !set.has('request.body.read')) {",
    "    return 'request.body.write requires request.body.read';",
    "  }",
    "  return null;",
    "}",
  ].join("\n")
);

const globalPermissionDependencyResult = runCheck(globalPermissionDependencyRoot);
if (
  globalPermissionDependencyResult.status === 0 ||
  !globalPermissionDependencyResult.stderr.includes(
    "packages/plugin-sdk/src/index.ts validatePermissionSet must accept PluginManifest"
  ) ||
  !globalPermissionDependencyResult.stderr.includes("gateway.request.afterBodyRead")
) {
  throw new Error(
    `expected hook-aware permission dependency failure, got status ${globalPermissionDependencyResult.status}\n${globalPermissionDependencyResult.stderr}`
  );
}
