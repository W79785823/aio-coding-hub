# 插件 Manifest

插件 manifest 文件名是 `plugin.json`，遵循 [Manifest v1 完整规范](../../plugin-manifest-v1.md)。

必填字段：

- `id`：带发布者命名空间的 ID，例如 `publisher.plugin-name`。
- `name`：展示给用户的插件名称。
- `version`：使用 SemVer 的插件版本。
- `apiVersion`：使用 SemVer 的插件 API 版本。
- `main`：Extension Host 入口文件，例如 `dist/extension.js`。
- `runtime`：社区插件必须使用 `runtime.kind = "extensionHost"`，`language` 必须是 `typescript`。
- `hostCompatibility`：应用版本和插件 API 兼容性约束。

`official.*` 命名空间只保留给内置官方插件。本地包、marketplace 包和 GitHub 包必须使用自己的发布者命名空间。

最小 Extension Host runtime：

```json
{
  "main": "dist/extension.js",
  "runtime": {
    "kind": "extensionHost",
    "language": "typescript"
  }
}
```

Gateway hook 贡献点示例；公开文档中的规范名是 `contributes.gatewayHooks`：

```json
{
  "activationEvents": ["onGatewayHook:gateway.request.afterBodyRead"],
  "contributes": {
    "gatewayHooks": [
      {
        "name": "gateway.request.afterBodyRead",
        "priority": 100,
        "failurePolicy": "fail-open"
      }
    ]
  },
  "capabilities": ["gateway.hooks"]
}
```

Capability dependency table：

| Contribution | Required capability |
| --- | --- |
| `commands` | `commands.execute` |
| `providers` | `provider.extensionValues` |
| `ui.providers.editor.sections` | `provider.extensionValues` |
| `ui.providers.editor.fields` | `provider.extensionValues` |
| `ui.providers.card.badges` | `provider.extensionValues` |
| `ui.providers.card.actions` | `provider.extensionValues` |
| `gatewayHooks` | `gateway.hooks` |
| `protocolBridges` | `protocol.bridge` |

`hostCompatibility` 必须包含 `app` 和 `pluginApi`；`platforms` 可以限制支持的操作系统。

`configSchema` 可以包含标准 JSON Schema 展示字段和 AIO `x-aio-ui` 元数据。详见 [Config Schema](./config-schema.md)。

plugin API v1 的 active hooks 见 [Hooks](./hooks.md)。Reserved hooks 和 reserved permissions 只是为未来兼容命名保留；在宿主真正实现前，manifest 校验会拒绝它们。

旧的 declarative rules、WASM、process 和第三方 native manifest 属于 unsupported pre-release legacy runtime。它们的旧字段会被当前公开校验拒绝，迁移说明见 [Legacy Declarative Rules](./declarative-rules.md) 和 [运行时说明](../runtime/README.md)。
