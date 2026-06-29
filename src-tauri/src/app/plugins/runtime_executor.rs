//! Usage: Runtime dispatch for gateway plugin execution.

use crate::app::plugins::official_privacy_filter_runtime::OfficialPrivacyFilterRuntime;
use crate::app::plugins::runtime_lifecycle::RuntimeLifecycleRegistry;
use crate::app::plugins::runtime_manager::{PluginRuntimeManager, RuntimeDispatch};
use crate::domain::plugins::PluginDetail;
use crate::gateway::plugins::context::{GatewayHookResult, GatewayVisibleHookContext};
use crate::gateway::plugins::permissions::GatewayPluginError;
use crate::gateway::plugins::pipeline::{GatewayHookFuture, GatewayPluginExecutor};
use std::sync::Arc;

pub(crate) struct RuntimeGatewayPluginExecutor {
    privacy_filter_runtime: Arc<OfficialPrivacyFilterRuntime>,
    lifecycle: RuntimeLifecycleRegistry,
}

impl RuntimeGatewayPluginExecutor {
    pub(crate) fn new() -> Self {
        let privacy_filter_runtime = Arc::new(OfficialPrivacyFilterRuntime::default());
        let lifecycle = RuntimeLifecycleRegistry::default();
        lifecycle.register_cache(privacy_filter_runtime.clone());
        Self {
            privacy_filter_runtime,
            lifecycle,
        }
    }

    #[cfg(test)]
    pub(crate) fn for_tests() -> Self {
        Self::new()
    }

    pub(crate) fn execute_plugin_sync(
        &self,
        plugin: &PluginDetail,
        context: GatewayVisibleHookContext,
    ) -> Result<GatewayHookResult, GatewayPluginError> {
        let manager = PluginRuntimeManager::new();

        match manager.runtime_dispatch(&plugin.summary.plugin_id, &plugin.manifest.runtime)? {
            RuntimeDispatch::NativePrivacyFilter => {
                self.privacy_filter_runtime.execute_plugin(plugin, context)
            }
            RuntimeDispatch::ExtensionHost => Err(GatewayPluginError::new(
                "PLUGIN_EXTENSION_HOST_GATEWAY_NOT_WIRED",
                "extension host gateway hook execution is not wired in this release",
            )),
        }
    }

    pub(crate) fn retain_runtime_caches_for_plugins(&self, plugins: &[PluginDetail]) {
        self.lifecycle.retain_for_plugins(plugins);
    }

    #[cfg(test)]
    pub(crate) fn dispose_runtime_caches_for_tests(&self) {
        self.lifecycle.dispose_all();
    }

    #[cfg(test)]
    fn privacy_filter_cache_size_for_tests(&self) -> usize {
        self.privacy_filter_runtime.cache_size_for_tests()
    }
}

impl Default for RuntimeGatewayPluginExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl GatewayPluginExecutor for RuntimeGatewayPluginExecutor {
    fn retain_runtime_caches_for_plugins(&self, plugins: &[PluginDetail]) {
        self.retain_runtime_caches_for_plugins(plugins);
    }

    fn execute_request_hook(
        &self,
        plugin: &PluginDetail,
        context: GatewayVisibleHookContext,
    ) -> GatewayHookFuture {
        let result = self.execute_plugin_sync(plugin, context);
        Box::pin(async move { result })
    }

    fn execute_response_hook(
        &self,
        plugin: &PluginDetail,
        context: GatewayVisibleHookContext,
    ) -> GatewayHookFuture {
        let result = self.execute_plugin_sync(plugin, context);
        Box::pin(async move { result })
    }

    fn execute_stream_hook(
        &self,
        plugin: &PluginDetail,
        context: GatewayVisibleHookContext,
    ) -> GatewayHookFuture {
        let result = self.execute_plugin_sync(plugin, context);
        Box::pin(async move { result })
    }

    fn execute_log_hook(
        &self,
        plugin: &PluginDetail,
        context: GatewayVisibleHookContext,
    ) -> GatewayHookFuture {
        let result = self.execute_plugin_sync(plugin, context);
        Box::pin(async move { result })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::plugin_contributions::PluginContributes;
    use crate::domain::plugins::{
        PluginDetail, PluginHook, PluginHostCompatibility, PluginInstallSource, PluginManifest,
        PluginPermissionRisk, PluginRuntime, PluginStatus, PluginSummary,
    };
    use crate::gateway::plugins::context::{
        GatewayVisibleHookContext, GatewayVisibleLogContext, GatewayVisibleRequestContext,
        GatewayVisibleResponseContext, GatewayVisibleStreamContext,
    };
    use serde_json::json;
    use std::collections::BTreeMap;

    #[test]
    fn runtime_executor_returns_temporary_error_for_extension_host_gateway_hook() {
        let plugin = extension_host_plugin_detail("example.extension");
        let context = hook_context("gateway.request.afterBodyRead", "trace-extension");

        let err = executor()
            .execute_plugin_sync(&plugin, context)
            .expect_err("extension host gateway hooks are not wired until Task 8");

        assert_eq!(err.code(), "PLUGIN_EXTENSION_HOST_GATEWAY_NOT_WIRED");
    }

    #[test]
    fn runtime_executor_rejects_non_official_privacy_filter_native_runtime() {
        let executor = RuntimeGatewayPluginExecutor::for_tests();
        let plugin = plugin_detail(
            "example.privacy-filter",
            PluginRuntime::Native {
                engine: "privacyFilter".to_string(),
            },
            "native:privacyFilter".to_string(),
            None,
        );
        let context = hook_context("gateway.request.afterBodyRead", "trace-native");

        let err = executor
            .execute_plugin_sync(&plugin, context)
            .expect_err("non-official native privacy filter should be rejected");

        assert_eq!(err.code(), "PLUGIN_UNSUPPORTED_RUNTIME");
        assert_eq!(
            err.to_string(),
            "PLUGIN_UNSUPPORTED_RUNTIME: unsupported native plugin runtime engine: privacyFilter"
        );
    }

    #[test]
    fn runtime_executor_retain_prunes_official_privacy_filter_runtime_cache() {
        let executor = executor();
        let plugin = official_privacy_filter_plugin_detail(json!({
            "redactBeforeUpstream": true,
            "redactLogs": true
        }));
        let context = hook_context("log.beforePersist", "trace-privacy");

        executor
            .execute_plugin_sync(&plugin, context)
            .expect("official privacy filter runtime executes");
        assert_eq!(executor.privacy_filter_cache_size_for_tests(), 1);

        executor.retain_runtime_caches_for_plugins(&[]);

        assert_eq!(executor.privacy_filter_cache_size_for_tests(), 0);
    }

    #[test]
    fn runtime_executor_disposes_registered_runtime_caches() {
        let executor = executor();
        let privacy_plugin = official_privacy_filter_plugin_detail(serde_json::json!({
            "redactBeforeUpstream": true,
            "redactLogs": true
        }));
        let privacy_context = hook_context("log.beforePersist", "trace-dispose");

        executor
            .execute_plugin_sync(&privacy_plugin, privacy_context)
            .expect("official privacy filter runtime executes");
        assert_eq!(executor.privacy_filter_cache_size_for_tests(), 1);

        executor.dispose_runtime_caches_for_tests();

        assert_eq!(executor.privacy_filter_cache_size_for_tests(), 0);
    }

    fn executor() -> RuntimeGatewayPluginExecutor {
        RuntimeGatewayPluginExecutor::for_tests()
    }

    fn hook_context(hook_name: &str, trace_id: &str) -> GatewayVisibleHookContext {
        GatewayVisibleHookContext {
            hook_name: hook_name.to_string(),
            trace_id: trace_id.to_string(),
            request: GatewayVisibleRequestContext {
                body: Some(
                    json!({ "messages": [{ "role": "user", "content": "hello" }] }).to_string(),
                ),
                ..GatewayVisibleRequestContext::default()
            },
            response: GatewayVisibleResponseContext::default(),
            stream: GatewayVisibleStreamContext::default(),
            log: GatewayVisibleLogContext::default(),
        }
    }

    fn extension_host_plugin_detail(plugin_id: &str) -> PluginDetail {
        plugin_detail(
            plugin_id,
            PluginRuntime::ExtensionHost {
                language: "typescript".to_string(),
            },
            "extensionHost".to_string(),
            None,
        )
    }

    fn official_privacy_filter_plugin_detail(config: serde_json::Value) -> PluginDetail {
        let fixture = crate::app::plugins::official::official_plugin("official.privacy-filter")
            .expect("official privacy filter fixture");
        let permissions = fixture.manifest.permissions.clone();
        PluginDetail {
            summary: PluginSummary {
                id: 1,
                plugin_id: fixture.manifest.id.clone(),
                name: fixture.manifest.name.clone(),
                current_version: Some(fixture.manifest.version.clone()),
                status: PluginStatus::Enabled,
                runtime: "native:privacyFilter".to_string(),
                permission_risk: PluginPermissionRisk::High,
                update_available: false,
                last_error: None,
                created_at: 1,
                updated_at: 1,
            },
            manifest: fixture.manifest,
            install_source: PluginInstallSource::Official,
            installed_dir: Some(fixture.root_dir.to_string_lossy().to_string()),
            config,
            granted_permissions: permissions,
            pending_permissions: vec![],
            audit_logs: vec![],
            runtime_failures: vec![],
            rollback_versions: vec![],
        }
    }

    fn plugin_detail(
        plugin_id: &str,
        runtime: PluginRuntime,
        runtime_summary: String,
        installed_dir: Option<String>,
    ) -> PluginDetail {
        PluginDetail {
            summary: PluginSummary {
                id: 1,
                plugin_id: plugin_id.to_string(),
                name: plugin_id.to_string(),
                current_version: Some("1.0.0".to_string()),
                status: PluginStatus::Enabled,
                runtime: runtime_summary,
                permission_risk: PluginPermissionRisk::High,
                update_available: false,
                last_error: None,
                created_at: 1,
                updated_at: 1,
            },
            manifest: PluginManifest {
                id: plugin_id.to_string(),
                name: plugin_id.to_string(),
                version: "1.0.0".to_string(),
                api_version: "1.0.0".to_string(),
                runtime,
                hooks: vec![],
                permissions: vec![],
                main: Some("dist/index.js".to_string()),
                activation_events: vec![],
                contributes: Some(PluginContributes {
                    providers: vec![],
                    protocols: vec![],
                    protocol_bridges: vec![],
                    commands: vec![],
                    gateway_hooks: vec![PluginHook {
                        name: "gateway.request.afterBodyRead".to_string(),
                        priority: 10,
                        failure_policy: Some("fail-open".to_string()),
                    }],
                    unsupported_gateway_rules: Default::default(),
                    ui: BTreeMap::new(),
                }),
                capabilities: vec!["gateway.hooks".to_string()],
                host_compatibility: PluginHostCompatibility {
                    app: ">=0.56.0 <1.0.0".to_string(),
                    plugin_api: "^1.0.0".to_string(),
                    platforms: vec![],
                },
                entry: None,
                config_schema: None,
                config_version: None,
                description: None,
                author: None,
                homepage: None,
                repository: None,
                license: None,
                checksum: None,
                signature: None,
                category: None,
            },
            install_source: PluginInstallSource::Local,
            installed_dir,
            config: json!({}),
            granted_permissions: vec![
                "request.body.read".to_string(),
                "request.body.write".to_string(),
            ],
            pending_permissions: vec![],
            audit_logs: vec![],
            runtime_failures: vec![],
            rollback_versions: vec![],
        }
    }
}
