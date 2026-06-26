# aio-coding-hub Plugin Example Developer Loop Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add runnable `create-aio-plugin` example templates for prompt-helper, redactor, and response-guard so plugin authors can validate, replay, pack, and publish-check realistic examples without changing Plugin API v1.

**Architecture:** Keep examples as pure `ScaffoldFiles` templates inside `packages/create-aio-plugin/src/scaffold.ts`; file-system writes continue to flow through the existing `create-aio-plugin <id> [template]` CLI path. Tests prove each example can pass strict validation, replay fixtures, pack, and publish-check. Docs keep the GUI marketplace boundary explicit: these examples are development templates, not default installable market packages.

**Tech Stack:** TypeScript, Vitest, `@aio-coding-hub/plugin-sdk`, existing `create-aio-plugin` devtools, Markdown docs.

---

## Scope Boundaries

- Do not change Plugin API v1 manifest shape.
- Do not add Plugin API v2.
- Do not expose Provider Plugin API.
- Do not open `plugin.storage`, `network.fetch`, `file.read`, `file.write`, or `secret.read`.
- Do not add JS/TS/WebView/browser plugin runtimes.
- Do not enable marketplace WASM execution.
- Do not change Tauri/Rust host install, runtime, signature, checksum, compatibility, or market trust boundaries.
- Do not make GUI featured example cards installable in this phase.
- Do not add a new `create-aio-plugin example ...` subcommand. Use the existing `create-aio-plugin <publisher.plugin-name> [template]` entry point.

## File Structure

- Modify: `packages/create-aio-plugin/src/scaffold.ts`
  - Extend `ScaffoldTemplate`.
  - Add `example:prompt-helper`, `example:redactor`, and `example:response-guard` templates.
  - Keep templates pure and side-effect free.
- Modify: `packages/create-aio-plugin/src/scaffold.test.ts`
  - Add in-memory tests for example files, strict validation, replay explain, pack, and publish-check.
  - Add CLI tests proving the existing scaffold command writes each example directory.
- Modify: `docs/plugins/developer-guide.md`
  - Document how authors generate and run example templates.
- Modify: `docs/plugins/examples/README.md`
  - Convert the examples table from aspirational wording to actual generated templates.
- Modify: `docs/plugins/examples/privacy-filter.md`
  - Clarify `official.privacy-filter` is still the only bundled official plugin; `examples/*` are templates.
- Modify: `docs/plugins/reference/publishing.md`
  - Clarify example templates can run `publish-check`, but are not published default market artifacts.
- Modify: `scripts/check-plugin-system-docs.mjs`
  - Add documentation contract phrases for the new example templates and product boundary.

## Task 1: Add Example Scaffold Templates And Devtools Tests

**Files:**
- Modify: `packages/create-aio-plugin/src/scaffold.ts`
- Modify: `packages/create-aio-plugin/src/scaffold.test.ts`

- [ ] **Step 1: Write failing tests for the three example templates and CLI path**

Append this `describe` block near the existing `create-aio-plugin scaffold` tests in `packages/create-aio-plugin/src/scaffold.test.ts`.

```ts
describe("create-aio-plugin example templates", () => {
  it("generates and replays the prompt-helper example", () => {
    const files = createPluginScaffold({
      id: "acme.prompt-helper",
      name: "Prompt Helper",
      template: "example:prompt-helper",
    });

    expect(files["plugin.json"]).toContain('"id": "acme.prompt-helper"');
    expect(files["rules/main.json"]).toContain("prompt-helper-claude");
    expect(files["fixtures/claude-request.json"]).toBeDefined();
    expect(files["fixtures/codex-request.json"]).toBeDefined();
    expect(validatePluginFilesStrict(files).ok).toBe(true);

    const claudeFixture = JSON.parse(files["fixtures/claude-request.json"] ?? "{}") as unknown;
    const claudeExplain = replayHookExplain(
      files,
      "gateway.request.afterBodyRead",
      claudeFixture
    );

    expect(claudeExplain).toMatchObject({
      pluginId: "acme.prompt-helper",
      actionKind: "replace",
      matchedRuleIds: ["prompt-helper-claude"],
      mutationSummary: { changed: true, field: "requestBody", targetField: "request.body" },
    });
    expect(JSON.stringify(claudeExplain.result)).toContain("Keep answers concise");

    const codexFixture = JSON.parse(files["fixtures/codex-request.json"] ?? "{}") as unknown;
    const codexExplain = replayHookExplain(
      files,
      "gateway.request.afterBodyRead",
      codexFixture
    );

    expect(codexExplain).toMatchObject({
      actionKind: "replace",
      matchedRuleIds: ["prompt-helper-codex"],
      mutationSummary: {
        changed: true,
        field: "requestBody",
        targetField: "request.body",
        jsonPath: "$.input[*].content[*].text",
      },
    });

    expectExampleCanPackAndPublishCheck(files, "acme.prompt-helper");
  });

  it("generates and replays the redactor example", () => {
    const files = createPluginScaffold({
      id: "acme.redactor",
      name: "Redactor",
      template: "example:redactor",
    });

    expect(files["plugin.json"]).toContain('"id": "acme.redactor"');
    expect(files["rules/main.json"]).toContain("redact-request-secrets");
    expect(files["fixtures/request-hit.json"]).toBeDefined();
    expect(files["fixtures/request-miss.json"]).toBeDefined();
    expect(files["fixtures/log-redact.json"]).toBeDefined();
    expect(validatePluginFilesStrict(files).ok).toBe(true);

    const hitFixture = JSON.parse(files["fixtures/request-hit.json"] ?? "{}") as unknown;
    const hitExplain = replayHookExplain(files, "gateway.request.beforeSend", hitFixture);
    expect(hitExplain).toMatchObject({
      actionKind: "replace",
      matchedRuleIds: ["redact-request-secrets"],
      mutationSummary: { changed: true, field: "requestBody", targetField: "request.body" },
    });
    expect(JSON.stringify(hitExplain.result)).toContain("[REDACTED]");

    const missFixture = JSON.parse(files["fixtures/request-miss.json"] ?? "{}") as unknown;
    const missExplain = replayHookExplain(files, "gateway.request.beforeSend", missFixture);
    expect(missExplain).toMatchObject({
      actionKind: "pass",
      mutationSummary: { changed: false },
    });

    const logFixture = JSON.parse(files["fixtures/log-redact.json"] ?? "{}") as unknown;
    const logExplain = replayHookExplain(files, "log.beforePersist", logFixture);
    expect(logExplain).toMatchObject({
      actionKind: "replace",
      matchedRuleIds: ["redact-log-secrets"],
      mutationSummary: { changed: true, field: "logMessage", targetField: "log.message" },
    });

    expectExampleCanPackAndPublishCheck(files, "acme.redactor");
  });

  it("generates and replays the response-guard example", () => {
    const files = createPluginScaffold({
      id: "acme.response-guard",
      name: "Response Guard",
      template: "example:response-guard",
    });

    expect(files["plugin.json"]).toContain('"id": "acme.response-guard"');
    expect(files["rules/main.json"]).toContain("response-guard-review-marker");
    expect(files["fixtures/response-warn.json"]).toBeDefined();
    expect(files["fixtures/response-pass.json"]).toBeDefined();
    expect(validatePluginFilesStrict(files).ok).toBe(true);

    const warnFixture = JSON.parse(files["fixtures/response-warn.json"] ?? "{}") as unknown;
    const warnExplain = replayHookExplain(files, "gateway.response.after", warnFixture);
    expect(warnExplain).toMatchObject({
      actionKind: "replace",
      matchedRuleIds: ["response-guard-review-marker"],
      mutationSummary: { changed: true, field: "responseBody", targetField: "response.body" },
    });
    expect(JSON.stringify(warnExplain.result)).toContain("[REVIEW_REQUIRED]");

    const passFixture = JSON.parse(files["fixtures/response-pass.json"] ?? "{}") as unknown;
    const passExplain = replayHookExplain(files, "gateway.response.after", passFixture);
    expect(passExplain).toMatchObject({
      actionKind: "pass",
      mutationSummary: { changed: false },
    });

    expectExampleCanPackAndPublishCheck(files, "acme.response-guard");
  });

  it.each([
    ["acme.prompt-helper", "example:prompt-helper"],
    ["acme.redactor", "example:redactor"],
    ["acme.response-guard", "example:response-guard"],
  ] as const)("writes %s through the CLI example template %s", (pluginId, template) => {
    const cwd = mkdtempSync(join(tmpdir(), "aio-plugin-example-"));
    const scaffoldOutput: string[] = [];
    const validateOutput: string[] = [];
    const packOutput: string[] = [];
    const publishOutput: string[] = [];

    expect(
      runCreateAioPluginCli([pluginId, template], cwd, {
        log: (line) => scaffoldOutput.push(line),
        error: () => undefined,
      })
    ).toBe(0);

    expect(existsSync(join(cwd, pluginId, "plugin.json"))).toBe(true);
    expect(existsSync(join(cwd, pluginId, "rules/main.json"))).toBe(true);
    expect(existsSync(join(cwd, pluginId, "README.md"))).toBe(true);

    expect(
      runCreateAioPluginCli(["validate", "--strict", `./${pluginId}`], cwd, {
        log: (line) => validateOutput.push(line),
        error: () => undefined,
      })
    ).toBe(0);
    expect(JSON.parse(validateOutput[0] ?? "{}")).toMatchObject({ ok: true });

    expect(
      runCreateAioPluginCli(["pack", `./${pluginId}`], cwd, {
        log: (line) => packOutput.push(line),
        error: () => undefined,
      })
    ).toBe(0);

    const packResult = JSON.parse(packOutput[0] ?? "{}") as {
      path: string;
      checksum: string;
      sizeBytes: number;
    };
    expect(packResult.path).toBe(join(cwd, `${pluginId}.aio-plugin`));
    expect(packResult.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(packResult.sizeBytes).toBeGreaterThan(0);
    expect(existsSync(packResult.path)).toBe(true);

    expect(
      runCreateAioPluginCli(["publish-check", `./${pluginId}`], cwd, {
        log: (line) => publishOutput.push(line),
        error: () => undefined,
      })
    ).toBe(0);

    const publishResult = JSON.parse(publishOutput[0] ?? "{}") as {
      artifactPath: string;
      manifestId: string;
      checksum: string;
      signatureVerified: boolean;
    };
    expect(publishResult).toMatchObject({
      artifactPath: join(cwd, `${pluginId}.aio-plugin`),
      manifestId: pluginId,
      signatureVerified: false,
    });
    expect(publishResult.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

function expectExampleCanPackAndPublishCheck(files: Record<string, string>, manifestId: string) {
  const packed = packPlugin(files);
  const result = publishCheckPluginBytes(packed.bytes, {
    checksum: packed.checksum,
    manifest: files["plugin.json"] ?? "",
  });

  expect(packed.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(result).toMatchObject({
    ok: true,
    manifestId,
    runtime: "declarativeRules",
    checksumVerified: true,
    signatureVerified: false,
    unsigned: true,
  });
  expect(result.hooks.length).toBeGreaterThan(0);
  expect(result.permissions.length).toBeGreaterThan(0);
}
```

- [ ] **Step 2: Run the example template tests and verify they fail**

Run:

```bash
pnpm --filter create-aio-plugin test -- src/scaffold.test.ts
```

Expected: FAIL because `ScaffoldTemplate` does not accept `example:prompt-helper`, `example:redactor`, or `example:response-guard`, and neither the in-memory scaffold path nor the existing CLI fallback can generate those files.

- [ ] **Step 3: Extend the scaffold template type and dispatcher**

In `packages/create-aio-plugin/src/scaffold.ts`, replace the current template type and dispatcher with this shape:

```ts
export type ScaffoldTemplate =
  | "rule"
  | "wasm"
  | "example:prompt-helper"
  | "example:redactor"
  | "example:response-guard";

export type ScaffoldInput = {
  id: string;
  name: string;
  template: ScaffoldTemplate;
};

export type ScaffoldFiles = Record<string, string>;

export function createPluginScaffold(input: ScaffoldInput): ScaffoldFiles {
  const id = normalizeId(input.id);
  const name = normalizeName(input.name);

  switch (input.template) {
    case "wasm":
      return wasmTemplate(id, name);
    case "example:prompt-helper":
      return promptHelperExampleTemplate(id, name);
    case "example:redactor":
      return redactorExampleTemplate(id, name);
    case "example:response-guard":
      return responseGuardExampleTemplate(id, name);
    case "rule":
    default:
      return ruleTemplate(id, name);
  }
}
```

- [ ] **Step 4: Add the prompt-helper example template**

Add this function to `packages/create-aio-plugin/src/scaffold.ts` after `ruleTemplate`:

```ts
function promptHelperExampleTemplate(id: string, name: string): ScaffoldFiles {
  const prompt = "Keep answers concise and include implementation steps.";
  const manifest: PluginManifest = {
    id,
    name,
    version: "0.1.0",
    apiVersion: "1.0.0",
    runtime: { kind: "declarativeRules", rules: ["rules/main.json"] },
    hooks: [{ name: "gateway.request.afterBodyRead", priority: 80 }],
    permissions: ["request.body.read", "request.body.write"],
    hostCompatibility: { app: ">=0.56.0 <1.0.0", pluginApi: "^1.0.0" },
    description: "Example prompt helper that adds a concise implementation instruction.",
  };

  const rules = {
    rules: [
      {
        id: "prompt-helper-claude",
        hook: "gateway.request.afterBodyRead",
        target: { field: "request.body" },
        match: { regex: '"messages"', caseSensitive: true },
        action: { kind: "appendMessage", role: "developer", content: prompt },
      },
      {
        id: "prompt-helper-codex",
        hook: "gateway.request.afterBodyRead",
        target: { field: "request.body", jsonPath: "$.input[*].content[*].text" },
        match: { regex: "(.+)", caseSensitive: true },
        action: {
          kind: "replace",
          replacement: `$1\n\nDeveloper instruction: ${prompt}`,
        },
      },
    ],
  };

  const claudeRequest = {
    request: {
      body: JSON.stringify({
        messages: [{ role: "user", content: "Explain how to add a plugin." }],
      }),
    },
  };
  const codexRequest = {
    request: {
      body: JSON.stringify({
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Explain how to add a plugin." }],
          },
        ],
      }),
    },
  };

  return {
    "plugin.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "rules/main.json": `${JSON.stringify(rules, null, 2)}\n`,
    "fixtures/claude-request.json": `${JSON.stringify(claudeRequest, null, 2)}\n`,
    "fixtures/codex-request.json": `${JSON.stringify(codexRequest, null, 2)}\n`,
    "README.md": exampleReadme(
      name,
      id,
      "Adds a concise implementation instruction to Claude and Codex/OpenAI request shapes.",
      [
        "pnpm create-aio-plugin validate --strict .",
        "pnpm create-aio-plugin replay --explain . fixtures/claude-request.json gateway.request.afterBodyRead",
        "pnpm create-aio-plugin replay --explain . fixtures/codex-request.json gateway.request.afterBodyRead",
        "pnpm create-aio-plugin pack .",
        "pnpm create-aio-plugin publish-check .",
      ]
    ),
  };
}
```

- [ ] **Step 5: Add the redactor example template**

Add this function to `packages/create-aio-plugin/src/scaffold.ts` after `promptHelperExampleTemplate`:

```ts
function redactorExampleTemplate(id: string, name: string): ScaffoldFiles {
  const secretPattern = "SECRET_[A-Za-z0-9_]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
  const manifest: PluginManifest = {
    id,
    name,
    version: "0.1.0",
    apiVersion: "1.0.0",
    runtime: { kind: "declarativeRules", rules: ["rules/main.json"] },
    hooks: [
      { name: "gateway.request.beforeSend", priority: 70 },
      { name: "log.beforePersist", priority: 70 },
    ],
    permissions: ["request.body.read", "request.body.write", "log.redact"],
    hostCompatibility: { app: ">=0.56.0 <1.0.0", pluginApi: "^1.0.0" },
    description: "Example declarative redactor for requests and persisted logs.",
  };

  const rules = {
    rules: [
      {
        id: "redact-request-secrets",
        hook: "gateway.request.beforeSend",
        target: { field: "request.body" },
        match: { regex: secretPattern, caseSensitive: true },
        action: { kind: "replace", replacement: "[REDACTED]" },
      },
      {
        id: "redact-log-secrets",
        hook: "log.beforePersist",
        target: { field: "log.message" },
        match: { regex: secretPattern, caseSensitive: true },
        action: { kind: "replace", replacement: "[REDACTED]" },
      },
    ],
  };

  return {
    "plugin.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "rules/main.json": `${JSON.stringify(rules, null, 2)}\n`,
    "fixtures/request-hit.json": `${JSON.stringify(
      {
        request: {
          body: JSON.stringify({
            messages: [{ role: "user", content: "Deploy with SECRET_TOKEN_123" }],
          }),
        },
      },
      null,
      2
    )}\n`,
    "fixtures/request-miss.json": `${JSON.stringify(
      {
        request: {
          body: JSON.stringify({
            messages: [{ role: "user", content: "Deploy with public configuration." }],
          }),
        },
      },
      null,
      2
    )}\n`,
    "fixtures/log-redact.json": `${JSON.stringify(
      { log: { message: "persisted SECRET_TOKEN_123 for alice@example.com" } },
      null,
      2
    )}\n`,
    "README.md": exampleReadme(
      name,
      id,
      "Redacts token-like values and email addresses from request bodies and persisted logs.",
      [
        "pnpm create-aio-plugin validate --strict .",
        "pnpm create-aio-plugin replay --explain . fixtures/request-hit.json gateway.request.beforeSend",
        "pnpm create-aio-plugin replay --explain . fixtures/request-miss.json gateway.request.beforeSend",
        "pnpm create-aio-plugin replay --explain . fixtures/log-redact.json log.beforePersist",
        "pnpm create-aio-plugin pack .",
        "pnpm create-aio-plugin publish-check .",
      ]
    ),
  };
}
```

- [ ] **Step 6: Add the response-guard example template**

Add this function to `packages/create-aio-plugin/src/scaffold.ts` after `redactorExampleTemplate`.

Use `gateway.response.after`, not `gateway.response.beforeSend`; the latter is not a Plugin API v1 hook in this codebase.

```ts
function responseGuardExampleTemplate(id: string, name: string): ScaffoldFiles {
  const manifest: PluginManifest = {
    id,
    name,
    version: "0.1.0",
    apiVersion: "1.0.0",
    runtime: { kind: "declarativeRules", rules: ["rules/main.json"] },
    hooks: [{ name: "gateway.response.after", priority: 60 }],
    permissions: ["response.body.read", "response.body.write"],
    hostCompatibility: { app: ">=0.56.0 <1.0.0", pluginApi: "^1.0.0" },
    description: "Example response guard that marks risky response text for review.",
  };

  const rules = {
    rules: [
      {
        id: "response-guard-review-marker",
        hook: "gateway.response.after",
        target: { field: "response.body" },
        match: { regex: "unsafe output|leak secret", caseSensitive: false },
        action: { kind: "replace", replacement: "[REVIEW_REQUIRED]" },
      },
    ],
  };

  return {
    "plugin.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "rules/main.json": `${JSON.stringify(rules, null, 2)}\n`,
    "fixtures/response-warn.json": `${JSON.stringify(
      { response: { status: 200, body: "This response contains unsafe output." } },
      null,
      2
    )}\n`,
    "fixtures/response-pass.json": `${JSON.stringify(
      { response: { status: 200, body: "This response is safe to show." } },
      null,
      2
    )}\n`,
    "README.md": exampleReadme(
      name,
      id,
      "Marks risky non-streaming response text for review before the client receives it.",
      [
        "pnpm create-aio-plugin validate --strict .",
        "pnpm create-aio-plugin replay --explain . fixtures/response-warn.json gateway.response.after",
        "pnpm create-aio-plugin replay --explain . fixtures/response-pass.json gateway.response.after",
        "pnpm create-aio-plugin pack .",
        "pnpm create-aio-plugin publish-check .",
      ]
    ),
  };
}
```

- [ ] **Step 7: Add the shared example README helper**

Add this helper near the template functions in `packages/create-aio-plugin/src/scaffold.ts`:

```ts
function exampleReadme(name: string, id: string, summary: string, commands: string[]) {
  return `# ${name}

Plugin ID: \`${id}\`.

${summary}

This example is a development template, not a default installable marketplace package.

## Try it

\`\`\`bash
${commands.join("\n")}
\`\`\`

The template uses Plugin API v1 declarative rules only. It does not require JavaScript, WebView, file, network, secret, or plugin storage permissions.
`;
}
```

- [ ] **Step 8: Run package tests and verify they pass**

Run:

```bash
pnpm --filter create-aio-plugin test -- src/scaffold.test.ts
```

Expected: PASS. The new tests verify strict validation, replay explain, pack, publish-check, and the existing CLI scaffold path for all three examples.

- [ ] **Step 9: Commit Task 1**

```bash
git add packages/create-aio-plugin/src/scaffold.ts packages/create-aio-plugin/src/scaffold.test.ts
git commit -m "feat(plugins): add example developer loop templates"
```

## Task 2: Sync Example Documentation And Documentation Contract

**Files:**
- Modify: `docs/plugins/developer-guide.md`
- Modify: `docs/plugins/examples/README.md`
- Modify: `docs/plugins/examples/privacy-filter.md`
- Modify: `docs/plugins/reference/publishing.md`
- Modify: `scripts/check-plugin-system-docs.mjs`

- [ ] **Step 1: Write failing docs contract checks**

In `scripts/check-plugin-system-docs.mjs`, add these phrases to the existing `docs/plugins/developer-guide.md` phrase list:

```js
"example:prompt-helper",
"example:redactor",
"example:response-guard",
"示例是开发模板，不是默认可安装市场包",
```

Add these phrases to the existing `docs/plugins/examples/README.md` phrase list:

```js
"example:prompt-helper",
"example:redactor",
"example:response-guard",
"fixtures/claude-request.json",
"fixtures/response-warn.json",
```

Add this phrase to the existing `docs/plugins/reference/publishing.md` phrase list:

```js
"示例模板可以运行 publish-check",
```

- [ ] **Step 2: Run docs check and verify it fails**

Run:

```bash
pnpm check:plugin-system-docs
```

Expected: FAIL because the new required phrases are not all documented yet.

- [ ] **Step 3: Update developer guide**

In `docs/plugins/developer-guide.md`, update the 10-minute quick start section after the generic `rule` scaffold commands with this text:

````md
也可以直接从完整示例模板开始：

```bash
pnpm create-aio-plugin acme.prompt-helper example:prompt-helper
pnpm create-aio-plugin acme.redactor example:redactor
pnpm create-aio-plugin acme.response-guard example:response-guard
```

示例是开发模板，不是默认可安装市场包。它们用于学习 manifest、rules、fixtures、`validate --strict`、`replay --explain`、`pack` 和 `publish-check` 的完整路径；Plugins 页面里的同名精选卡片仍保持示例状态，不会绕过宿主安装校验。
````

In the replay command section, add one example command:

````md
例如 prompt-helper 示例可以直接回放 Claude 和 Codex fixtures：

```bash
pnpm create-aio-plugin replay --explain ./acme.prompt-helper ./acme.prompt-helper/fixtures/claude-request.json gateway.request.afterBodyRead
pnpm create-aio-plugin replay --explain ./acme.prompt-helper ./acme.prompt-helper/fixtures/codex-request.json gateway.request.afterBodyRead
```
````

- [ ] **Step 4: Update examples README**

Replace the examples table in `docs/plugins/examples/README.md` with this table:

```md
| 示例 ID | 生成模板 | 目标 | Hooks | Permissions | Fixtures / 覆盖路径 |
| --- | --- | --- | --- | --- | --- |
| `official.privacy-filter` | 内置官方插件 | 请求和日志脱敏 | `gateway.request.afterBodyRead`, `gateway.request.beforeSend`, `log.beforePersist` | `request.body.read`, `request.body.write`, `log.redact` | 官方 fixture 存在于宿主资源目录；覆盖配置 UI、request replay export 和日志脱敏边界 |
| `examples/prompt-helper` | `example:prompt-helper` | 在请求进入 provider 前补充提示词约束 | `gateway.request.afterBodyRead` | `request.body.read`, `request.body.write` | 包含 `fixtures/claude-request.json` 和 `fixtures/codex-request.json`；覆盖 Claude messages 和 Codex/OpenAI Responses request mutation |
| `examples/redactor` | `example:redactor` | 展示社区 declarativeRules 脱敏形态 | `gateway.request.beforeSend`, `log.beforePersist` | `request.body.read`, `request.body.write`, `log.redact` | 包含 request hit/miss 和 log redact fixtures；覆盖 pack、publish-check 和市场安装元数据 |
| `examples/response-guard` | `example:response-guard` | 在 non-stream 响应返回后做轻量检查或标记 | `gateway.response.after` | `response.body.read`, `response.body.write` | 包含 `fixtures/response-warn.json` 和 `fixtures/response-pass.json`；覆盖响应 mutation 和 pass 路径 |
```

Add this paragraph below the table:

```md
`examples/*` 是开发模板，不是默认可安装市场包。生成出的目录可以运行 `validate --strict`、`replay --explain`、`pack` 和 `publish-check`；发布为真实 `.aio-plugin` artifact 仍需要单独的 checksum、signature、托管和市场索引流程。
```

- [ ] **Step 5: Update privacy filter docs**

In `docs/plugins/examples/privacy-filter.md`, keep `official.privacy-filter` as the only bundled official plugin and add:

```md
`examples/prompt-helper`、`examples/redactor` 和 `examples/response-guard` 现在由 `create-aio-plugin` 作为开发模板生成。它们帮助作者学习 Plugin API v1 和 devtools 闭环，但不是宿主内置插件，也不是默认可安装市场包。
```

- [ ] **Step 6: Update publishing reference**

In `docs/plugins/reference/publishing.md`, add this paragraph near the `publish-check` section:

```md
示例模板可以运行 publish-check，例如 `example:prompt-helper`、`example:redactor` 和 `example:response-guard` 生成的目录都应能输出发布 metadata。这个 metadata 只说明包具备发布前检查信息；它不代表示例已经被上传、签名、加入默认 market index，或变成默认可安装市场包。
```

- [ ] **Step 7: Run docs checks**

Run:

```bash
pnpm check:plugin-system-docs
pnpm check:spec-links
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add docs/plugins/developer-guide.md docs/plugins/examples/README.md docs/plugins/examples/privacy-filter.md docs/plugins/reference/publishing.md scripts/check-plugin-system-docs.mjs
git commit -m "docs(plugins): document example developer loop templates"
```

## Final Verification

Run all commands:

```bash
pnpm --filter create-aio-plugin test
pnpm --filter create-aio-plugin typecheck
pnpm check:plugin-system-docs
pnpm check:spec-links
pnpm typecheck
pnpm lint
```

Expected: all commands pass.

## Acceptance Checklist

- [ ] `create-aio-plugin <id> example:prompt-helper` creates `plugin.json`, `rules/main.json`, `fixtures/claude-request.json`, `fixtures/codex-request.json`, and `README.md`.
- [ ] `create-aio-plugin <id> example:redactor` creates request hit/miss and log redact fixtures.
- [ ] `create-aio-plugin <id> example:response-guard` creates response warn/pass fixtures using `gateway.response.after`.
- [ ] All three examples pass `validate --strict`.
- [ ] All three examples have at least one `replay --explain` path with expected `actionKind`, `matchedRuleIds`, and `mutationSummary`.
- [ ] All three examples can be packed.
- [ ] All three examples can run `publish-check`.
- [ ] Docs explain how to choose and run the examples.
- [ ] Docs and GUI semantics remain aligned: examples are development templates, not default installable market packages.
- [ ] No Plugin API v1, backend install boundary, runtime capability, generated binding, or GUI market install state changes are introduced.
