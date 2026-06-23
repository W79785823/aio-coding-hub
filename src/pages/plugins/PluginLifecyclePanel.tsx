// Usage: Summarizes plugin lifecycle status, source trust, quarantine, and rollback controls.

import { RotateCcw, ShieldAlert } from "lucide-react";
import type { JsonValue, PluginDetail } from "../../services/plugins";
import { Button } from "../../ui/Button";
import { pluginStatusLabel } from "./pluginProductCopy";

type PluginLifecyclePanelProps = {
  detail: PluginDetail;
  rollbackVersion: string | null;
  busy: boolean;
  onRollback: (version: string) => void;
};

const INSTALL_SOURCE_LABELS: Record<string, string> = {
  local: "本地",
  market: "市场",
  github_release: "GitHub Release",
  offline: "离线",
  official: "官方",
};

function jsonRecord(value: JsonValue): Record<string, JsonValue> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  return null;
}

function stringDetail(value: JsonValue | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function auditString(detail: PluginDetail, keys: readonly string[]) {
  for (const log of detail.audit_logs) {
    const details = jsonRecord(log.details);
    if (!details) continue;
    for (const key of keys) {
      const value = stringDetail(details[key]);
      if (value) return value;
    }
  }
  return null;
}

function isUnsigned(detail: PluginDetail) {
  return detail.audit_logs.some((log) => jsonRecord(log.details)?.unsigned === true);
}

function quarantineReason(detail: PluginDetail) {
  const fromAudit = detail.audit_logs
    .filter((log) => log.event_type === "plugin.quarantined")
    .map((log) => stringDetail(jsonRecord(log.details)?.reason))
    .find(Boolean);
  return fromAudit ?? detail.summary.last_error;
}

export function PluginLifecyclePanel({
  detail,
  rollbackVersion,
  busy,
  onRollback,
}: PluginLifecyclePanelProps) {
  const checksum = auditString(detail, ["packageChecksum", "checksum"]);
  const unsigned = isUnsigned(detail);
  const sourceLabel = INSTALL_SOURCE_LABELS[detail.install_source] ?? detail.install_source;
  const reason = quarantineReason(detail);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">生命周期</h2>
        {rollbackVersion ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onRollback(rollbackVersion)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            回滚 {rollbackVersion}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-xs text-muted-foreground">状态</div>
          <div className="mt-1 text-foreground">{pluginStatusLabel(detail.summary.status)}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-xs text-muted-foreground">来源</div>
          <div className="mt-1 text-foreground">{sourceLabel}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-xs text-muted-foreground">信任</div>
          <div className="mt-1 text-foreground">{unsigned ? "未签名" : "签名已验证"}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-xs text-muted-foreground">回滚</div>
          <div className="mt-1 text-foreground">
            {rollbackVersion ? `可回滚到 ${rollbackVersion}` : "暂无可回滚版本"}
          </div>
        </div>
        <div className="rounded-md border border-border px-3 py-2 sm:col-span-2">
          <div className="text-xs text-muted-foreground">Checksum</div>
          <div className="mt-1 break-all font-mono text-xs text-foreground">{checksum ?? "-"}</div>
        </div>
      </div>

      {detail.summary.status === "quarantined" || reason ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">隔离原因</div>
            <div className="mt-0.5 break-words">{reason ?? "插件已被隔离"}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
