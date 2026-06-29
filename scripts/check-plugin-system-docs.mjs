import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);

const requiredDocs = [
  {
    path: "docs/plugin-system-rfc.md",
    phrases: [
      "短期不执行任意 JavaScript/TypeScript",
      "提示词优化只能在网关请求阶段可靠实现",
      "第三方代码不得直接进入主进程或 WebView",
      "Skill 市场",
      "gateway.request.afterBodyRead",
      "Final Gateway Hook Chain",
      "gateway.request.beforeSend (active upstream header/body mutation)",
      "gateway.response.chunk (active SSE chunk inspect/modify/block)",
      "log.beforePersist (active request log redaction before enqueue)",
      "WASM",
    ],
  },
  {
    path: "docs/plugin-manifest-v1.md",
    phrases: [
      "publisher.plugin-name",
      "SemVer",
      "apiVersion",
      "hostCompatibility",
      "main",
      "runtime.kind = \"extensionHost\"",
      "contributes.gatewayHooks",
      "capabilities: [\"gateway.hooks\"]",
      "api.gateway.registerHook",
      "commands -> commands.execute",
      "providers / provider UI -> provider.extensionValues",
      "gatewayHooks -> gateway.hooks",
      "protocolBridges -> protocol.bridge",
      "gateway.response.chunk",
      "Active hooks in plugin API v1",
      "Reserved hooks for future host integration",
      "Reserved permissions for future host-mediated APIs",
      "request.header.readSensitive",
      "official.privacy-filter",
      "acme.prompt-helper",
      "quarantined",
      "高危权限需要二次授权",
      "插件升级新增权限必须重新授权",
    ],
    forbiddenPhrases: ['"kind": "declarativeRules"', '"kind": "wasm"', '"gatewayRules"'],
  },
  {
    path: "docs/plugins/README.md",
    phrases: [
      "插件开发手册",
      "插件开发总指南",
      "按目标查找",
      "插件 API 参考",
      "Privacy Filter 示例",
      "Manifest",
      "Hooks",
      "Permissions",
    ],
  },
  {
    path: "docs/plugins/developer-guide.md",
    phrases: [
      "插件开发总指南",
      "plugin.json",
      "Extension Host",
      "doctor -> validate --strict -> replay --explain -> export replay fixture -> fix -> pack",
      "plugin_export_replay_fixture",
      "publish-check",
      "dist/extension.js",
      "runtime.kind = \"extensionHost\"",
      "contributes.gatewayHooks",
      "capabilities",
      "api.gateway.registerHook",
      "gateway.request.beforeSend",
      "request.normalizedMessages",
      "configSchema",
      "x-aio-ui",
      "pnpm create-aio-plugin validate",
      "pnpm create-aio-plugin replay",
      "pnpm create-aio-plugin pack",
      ".aio-plugin",
      "official.privacy-filter",
      "精选插件",
      "高级来源",
      "example:prompt-helper",
      "example:redactor",
      "example:response-guard",
      "示例是开发模板，不是默认可安装市场包",
    ],
    forbiddenPhrases: [
      "`declarativeRules` 是默认社区运行时",
      "WASM 适合需要确定性代码逻辑的插件",
      "pnpm plugin-wasm-sdk:test",
      "最小声明式规则插件",
    ],
  },
  {
    path: "docs/plugins/runtime/wasm.md",
    phrases: [
      "unsupported pre-release legacy runtime",
      "not part of the public Plugin API v1 community runtime surface",
      "community plugins must migrate to Extension Host",
      "runtime.kind = \"extensionHost\"",
    ],
    forbiddenPhrases: [
      "WASM packages are installable only when host policy enables execution",
      "WASM 只用于宿主策略启用后",
      "插件作者应使用",
    ],
  },
  {
    path: "docs/plugins/runtime/process-poc.md",
    phrases: [
      "unsupported pre-release legacy runtime",
      "not part of the public Plugin API v1 community runtime surface",
      "Extension Host",
      "JSON-RPC over stdio",
      "disabled by default",
    ],
    forbiddenPhrases: ["服务于未来无法放进 WASM ABI"],
  },
  {
    path: "docs/plugins/developer-guide.md",
    phrases: [
      "create-aio-plugin",
      "pnpm create-aio-plugin",
      "pnpm create-aio-plugin validate",
      "pnpm create-aio-plugin replay",
      "pnpm create-aio-plugin pack",
      "从 Plugins 页面本地安装",
      "Claude 和 Codex request shapes",
      "@aio-coding-hub/plugin-sdk",
      "plugin.json",
      "最小 Extension Host 插件",
      "Extension Host",
    ],
  },
  {
    path: "docs/plugins/reference/sdk.md",
    phrases: [
      "@aio-coding-hub/plugin-sdk",
      "PluginManifest",
      "validateManifest",
      "permissionRisk",
      "Extension Host",
      "runtime: { kind: \"extensionHost\"",
      "api.gateway.registerHook",
      "SDK 边界",
    ],
    forbiddenPhrases: ["aio-plugin-wasm-sdk", "runtime: { kind: \"declarativeRules\""],
  },
  {
    path: "docs/plugins/reference/declarative-rules.md",
    phrases: [
      "unsupported pre-release legacy runtime",
      "declarativeRules",
      "migrate to Extension Host",
      "contributes.gatewayHooks",
      "api.gateway.registerHook",
    ],
    forbiddenPhrases: [
      "`declarativeRules` 是社区插件当前优先使用的运行时",
      "应使用 WASM 或未来的隔离进程运行时",
    ],
  },
  {
    path: "docs/plugins/examples/privacy-filter.md",
    phrases: [
      "official.privacy-filter",
      "packyme/privacy-filter",
      "host-owned built-in",
      "社区插件不能使用 `native:privacyFilter`",
      "Extension Host",
      "已移除的内置示例",
    ],
    forbiddenPhrases: ["社区示例应优先使用 `declarativeRules`"],
  },
  {
    path: "docs/plugins/examples/README.md",
    phrases: [
      "example:prompt-helper",
      "example:redactor",
      "example:response-guard",
      "fixtures/claude-request.json",
      "fixtures/response-warn.json",
      "不是默认可安装市场包",
      "checksum",
      "signature",
      "托管",
      "市场索引流程",
    ],
  },
  {
    path: "docs/plugins/architecture/audit.md",
    phrases: [
      "official.privacy-filter",
      "Extension Host",
      "gatewayHooks",
      "protocolBridges",
      "unsupported pre-release legacy runtime",
      "信任边界",
      "性能与稳定性建议",
      "0.62 does not add public provider plugin APIs",
    ],
    caseInsensitivePhrases: ["provider adapter facades remain internal"],
  },
  {
    path: "docs/plugins/reference/manifest.md",
    phrases: [
      "apiVersion",
      "hostCompatibility",
      "runtime.kind = \"extensionHost\"",
      "main",
      "contributes.gatewayHooks",
      "capabilities",
    ],
    forbiddenPhrases: ['{ "kind": "declarativeRules"', '{ "kind": "wasm"'],
  },
  {
    path: "docs/plugins/reference/hooks.md",
    phrases: [
      "gateway.request.afterBodyRead",
      "gateway.response.chunk",
      "log.beforePersist",
      "plugin_hook_execution_reports",
      "plugin_export_replay_fixture",
      "默认 vNext hook timeout: 150 ms",
    ],
  },
  {
    path: "docs/plugins/reference/permissions.md",
    phrases: ["request.body.read", "secret.read", "critical", "重新授权"],
  },
  {
    path: "docs/plugins/reference/config-schema.md",
    phrases: [
      "string",
      "number",
      "boolean",
      "password",
      "enum is supported as a keyword",
      "vNext does not provide host-managed secret storage",
    ],
  },
  {
    path: "docs/plugins/architecture/security.md",
    phrases: [
      "fail-closed",
      "quarantined",
      "Extension Host",
      "不在 Rust 主进程或 Tauri WebView 执行第三方插件代码",
      "默认 vNext hook timeout: 150 ms",
    ],
  },
  {
    path: "docs/plugins/runtime/streaming.md",
    phrases: ["sliding window", "gateway.response.chunk", "stream.modify"],
  },
  {
    path: "docs/plugins/reference/publishing.md",
    phrases: [
      ".aio-plugin",
      "sha256",
      "Ed25519",
      "rollback",
      "publish-check",
      "market index URL",
      "trusted public key",
      "revoked / incompatible install blocks",
      "plugin_export_replay_fixture",
      "默认市场视图",
      "自定义 market index 属于高级来源",
      "示例模板可以运行 publish-check",
      "不代表示例已经被上传、签名、加入默认 market index",
    ],
  },
  {
    path: "docs/plugins/runtime/README.md",
    phrases: [
      "Host Runtime Lifecycle",
      "plugin_hook_execution_reports",
      "host-owned lifecycle",
      "Dispose",
    ],
  },
  {
    path: "docs/plugins/reference/compatibility.md",
    phrases: [
      "SemVer",
      "pluginApi",
      "platforms",
      "Plugin API v1 remains externally compatible in 0.62",
      "0.62 does not add public provider plugin APIs",
      "Extension Host is the only community runtime",
      "unsupported pre-release legacy runtime",
    ],
    forbiddenPhrases: ['{ "kind": "wasm"', "社区插件继续使用 `declarativeRules`"],
  },
];

const failures = [];

for (const doc of requiredDocs) {
  const fullPath = join(repoRoot, doc.path);
  if (!existsSync(fullPath)) {
    failures.push(`${doc.path}: missing required document`);
    continue;
  }

  const text = readFileSync(fullPath, "utf8");
  for (const phrase of doc.phrases) {
    if (!text.includes(phrase)) {
      failures.push(`${doc.path}: missing required phrase "${phrase}"`);
    }
  }

  const normalizedText = text.toLowerCase();
  for (const phrase of doc.caseInsensitivePhrases ?? []) {
    if (!normalizedText.includes(phrase.toLowerCase())) {
      failures.push(`${doc.path}: missing required phrase "${phrase}"`);
    }
  }

  for (const phrase of doc.forbiddenPhrases ?? []) {
    if (text.includes(phrase)) {
      failures.push(`${doc.path}: forbidden phrase "${phrase}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Plugin system documentation contract failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}
