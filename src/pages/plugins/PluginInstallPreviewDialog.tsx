// Usage: Shows local plugin package validation details before installation.

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { PluginInstallPreview } from "../../services/plugins";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { describePluginPermission, pluginRiskLabel } from "./pluginProductCopy";

type PluginInstallPreviewDialogProps = {
  preview: PluginInstallPreview | null;
  filePath: string | null;
  open: boolean;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type PluginLifecycleNotice = PluginInstallPreview["warnings"][number];

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    local: "本地",
    market: "市场",
    github_release: "GitHub Release",
    offline: "离线",
    official: "官方",
  };
  return labels[source] ?? source;
}

function NoticeList({ notices }: { notices: readonly PluginLifecycleNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="grid gap-2">
      {notices.map((notice) => (
        <div
          key={`${notice.severity}:${notice.code}:${notice.message}`}
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          <div className="font-medium">{notice.message}</div>
          <div className="mt-0.5 font-mono text-xs opacity-80">{notice.code}</div>
        </div>
      ))}
    </div>
  );
}

export function PluginInstallPreviewDialog({
  preview,
  filePath,
  open,
  confirming,
  onClose,
  onConfirm,
}: PluginInstallPreviewDialogProps) {
  const blocked = Boolean(preview && preview.blockingReasons.length > 0);
  const canConfirm = Boolean(preview) && !blocked;

  return (
    <Dialog
      open={open}
      title="安装前预检"
      description="确认本地插件包的来源、权限和兼容性后再安装。"
      className="max-w-2xl"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      {!preview ? (
        <div className="text-sm text-muted-foreground">暂无插件预检结果。</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground">{preview.name}</div>
              <div className="break-words font-mono text-xs text-muted-foreground">
                {preview.pluginId}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                {preview.version}
              </span>
              <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                {sourceLabel(preview.source)}
              </span>
              {preview.trust.unsigned ? (
                <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  未签名
                </span>
              ) : (
                <span className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                  签名已验证
                </span>
              )}
            </div>
          </div>

          {preview.description ? (
            <div className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
              {preview.description}
            </div>
          ) : null}

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">运行方式</div>
              <div className="mt-1 text-foreground">{preview.runtime.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {preview.runtime.supported ? "当前宿主支持" : "当前宿主不支持"}
              </div>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">兼容性</div>
              <div className="mt-1 flex items-center gap-2 text-foreground">
                {preview.compatibility.compatible ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                {preview.compatibility.compatible ? "可安装" : "需要处理阻断项"}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                app {preview.compatibility.appRange} / api {preview.compatibility.pluginApiRange}
              </div>
            </div>
            <div className="rounded-md border border-border px-3 py-2 sm:col-span-2">
              <div className="text-xs text-muted-foreground">Checksum</div>
              <div className="mt-1 break-all font-mono text-xs text-foreground">
                {preview.trust.checksum}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">权限</div>
            <div className="grid gap-2">
              {preview.permissions.length > 0 ? (
                preview.permissions.map((permission) => {
                  const copy = describePluginPermission(permission.permission);
                  return (
                    <div
                      key={permission.permission}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">{copy.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{copy.detail}</div>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {permission.permission}
                        </div>
                      </div>
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                        {pluginRiskLabel(permission.risk)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                  插件未请求额外权限
                </div>
              )}
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                <ShieldAlert className="h-4 w-4" />
                警告
              </div>
              <NoticeList notices={preview.warnings} />
            </div>
          ) : null}

          {preview.blockingReasons.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                阻断项
              </div>
              <NoticeList notices={preview.blockingReasons} />
            </div>
          ) : null}

          {filePath ? (
            <div className="break-all font-mono text-xs text-muted-foreground">{filePath}</div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={confirming}>
              取消
            </Button>
            <Button onClick={onConfirm} disabled={!canConfirm || confirming}>
              {confirming ? "安装中..." : "确认安装"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
