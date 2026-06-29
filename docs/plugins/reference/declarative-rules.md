# Legacy Declarative Rules 迁移说明

`declarativeRules` 是 unsupported pre-release legacy runtime。它不再是社区插件推荐路径，也不是 Plugin API v1 的公开 community runtime。当前社区插件必须 migrate to Extension Host：在 manifest 中声明 `main`、`runtime.kind = "extensionHost"`、`contributes.gatewayHooks` 和对应 capability，并在入口里使用 `api.gateway.registerHook`。

旧包如果仍声明 `runtime.kind` 为该运行时，会被当前 manifest validation 拒绝。本文只解释迁移，不再维护旧规则语法作为当前开发指南。

## Manifest 迁移

旧形态通常把规则文件放在 runtime 或旧 contribution 中。迁移后，hook 声明进入 `contributes.gatewayHooks`：

```json
{
  "main": "dist/extension.js",
  "runtime": {
    "kind": "extensionHost",
    "language": "typescript"
  },
  "activationEvents": ["onGatewayHook:gateway.request.afterBodyRead"],
  "contributes": {
    "gatewayHooks": [
      {
        "name": "gateway.request.afterBodyRead",
        "priority": 50,
        "failurePolicy": "fail-open"
      }
    ]
  },
  "capabilities": ["gateway.hooks"]
}
```

不要使用 top-level hooks、top-level permissions 或 legacy gateway rule contribution。当前公开 API 只接受 Extension Host contribution points。

## 规则逻辑迁移

把规则文件里的 match/action 改写为普通 JavaScript 逻辑：

```js
const tokenPattern = /sk-[A-Za-z0-9_-]{20,}/g;

module.exports.activate = function(api) {
  api.gateway.registerHook("gateway.request.afterBodyRead", function(context) {
    const body = String(context?.request?.body ?? "");
    const nextBody = body.replace(tokenPattern, "[REDACTED]");
    if (nextBody === body) return { action: "continue" };
    return { action: "replace", requestBody: nextBody };
  });
};
```

常见映射：

| Legacy idea | Extension Host replacement |
| --- | --- |
| `target.field = request.body` | Read `context.request.body` and return `requestBody`。 |
| `target.field = response.body` | Read `context.response.body` and return `responseBody`。 |
| `target.field = stream.chunk` | Read `context.stream.chunk` and return `streamChunk`。 |
| `target.field = log.message` | Read `context.log.message` and return `logMessage`。 |
| `replace` action | Return `{ action: "replace", ... }`。 |
| `block` action | Return `{ action: "block", reason }`。 |
| `warn` action | Return `{ action: "warn", message }`。 |

## 验证

迁移后使用同一套开发闭环：

```bash
pnpm --filter create-aio-plugin cli validate --strict ./acme.redactor
pnpm --filter create-aio-plugin cli pack ./acme.redactor
pnpm --filter create-aio-plugin cli publish-check ./acme.redactor
```

`create-aio-plugin replay` 当前不在本地执行 Extension Host gateway hooks；迁移后的 hook 行为应在宿主中启用插件后，通过 `plugin_hook_execution_reports`、`plugin_export_replay_fixture` 和桌面应用内复测确认。

如果旧包无法启用，优先查看 `PLUGIN_UNSUPPORTED_RUNTIME`、`PLUGIN_INVALID_MANIFEST` 或 `PLUGIN_INVALID_CONTRIBUTION`。这些错误表示包仍包含 pre-release legacy runtime 字段，需要按上面的 Extension Host 形态迁移。
