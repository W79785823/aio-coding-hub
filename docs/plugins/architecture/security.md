# 插件安全与隔离

插件系统围绕最小权限和运行时隔离设计。默认 vNext hook timeout: 150 ms。

核心规则：

- Extension Host 是唯一 community runtime。
- 不在 Rust 主进程或 Tauri WebView 执行第三方插件代码。
- Extension Host 只暴露 capability-gated APIs。
- Legacy WASM、process 和 declarative rules 都是 unsupported pre-release legacy runtime。
- Hook 失败必须记录审计事件。
- 高风险 hook 可以使用 fail-closed 策略。
- 重复 runtime failure 可以让插件进入 `quarantined` 状态。

未签名离线包会受到限制。除非未来明确的可信策略允许，否则 high 和 critical 权限会被拒绝。
