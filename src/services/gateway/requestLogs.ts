import {
  commands,
  type RequestAttemptLog as GeneratedRequestAttemptLog,
  type RequestLogDetail as GeneratedRequestLogDetail,
  type RequestLogRouteHop as GeneratedRequestLogRouteHop,
  type RequestLogSummary as GeneratedRequestLogSummary,
} from "../../generated/bindings";
import type { CliKey } from "../providers/providers";
import { invokeGeneratedIpc, mapGeneratedCommandResponse } from "../generatedIpc";
import { narrowGeneratedStringUnion, type Override } from "../generatedTypeUtils";

const CLI_KEY_VALUES = ["claude", "codex", "gemini"] as const satisfies readonly CliKey[];

export type RequestLogRouteHop = GeneratedRequestLogRouteHop;

export type RequestLogSummary = Override<
  GeneratedRequestLogSummary,
  {
    cli_key: CliKey;
  }
>;

export type RequestLogDetail = Override<
  GeneratedRequestLogDetail,
  {
    cli_key: CliKey;
  }
>;

export type RequestAttemptLog = Override<
  GeneratedRequestAttemptLog,
  {
    cli_key: CliKey;
  }
>;

function toCliKey(value: string, label: string): CliKey {
  return narrowGeneratedStringUnion(value, CLI_KEY_VALUES, label);
}

function toRequestLogSummary(value: GeneratedRequestLogSummary): RequestLogSummary {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "request_logs_list.cli_key"),
  };
}

function toRequestLogDetail(value: GeneratedRequestLogDetail): RequestLogDetail {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "request_log_get.cli_key"),
  };
}

function toRequestAttemptLog(value: GeneratedRequestAttemptLog): RequestAttemptLog {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "request_attempt_logs_by_trace_id.cli_key"),
  };
}

export async function requestLogsList(cliKey: CliKey, limit?: number) {
  return invokeGeneratedIpc<RequestLogSummary[]>({
    title: "读取请求日志失败",
    cmd: "request_logs_list",
    args: { cliKey, limit: limit ?? null },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.requestLogsList(cliKey, limit ?? null), (rows) =>
        rows.map(toRequestLogSummary)
      ),
  });
}

export async function requestLogsListAll(limit?: number) {
  return invokeGeneratedIpc<RequestLogSummary[]>({
    title: "读取全局请求日志失败",
    cmd: "request_logs_list_all",
    args: { limit: limit ?? null },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.requestLogsListAll(limit ?? null), (rows) =>
        rows.map(toRequestLogSummary)
      ),
  });
}

export async function requestLogsListAfterId(cliKey: CliKey, afterId: number, limit?: number) {
  return invokeGeneratedIpc<RequestLogSummary[]>({
    title: "读取增量请求日志失败",
    cmd: "request_logs_list_after_id",
    args: { cliKey, afterId, limit: limit ?? null },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.requestLogsListAfterId(cliKey, afterId, limit ?? null),
        (rows) => rows.map(toRequestLogSummary)
      ),
  });
}

export async function requestLogsListAfterIdAll(afterId: number, limit?: number) {
  return invokeGeneratedIpc<RequestLogSummary[]>({
    title: "读取全局增量请求日志失败",
    cmd: "request_logs_list_after_id_all",
    args: { afterId, limit: limit ?? null },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.requestLogsListAfterIdAll(afterId, limit ?? null),
        (rows) => rows.map(toRequestLogSummary)
      ),
  });
}

export async function requestLogGet(logId: number) {
  return invokeGeneratedIpc<RequestLogDetail>({
    title: "读取请求日志详情失败",
    cmd: "request_log_get",
    args: { logId },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.requestLogGet(logId), toRequestLogDetail),
  });
}

export async function requestLogGetByTraceId(traceId: string) {
  return invokeGeneratedIpc<RequestLogDetail | null, null>({
    title: "按追踪 ID 读取请求日志失败",
    cmd: "request_log_get_by_trace_id",
    args: { traceId },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.requestLogGetByTraceId(traceId), (value) =>
        value == null ? null : toRequestLogDetail(value)
      ),
    nullResultBehavior: "return_fallback",
    fallback: null,
  });
}

export async function requestAttemptLogsByTraceId(traceId: string, limit?: number) {
  return invokeGeneratedIpc<RequestAttemptLog[]>({
    title: "读取请求尝试日志失败",
    cmd: "request_attempt_logs_by_trace_id",
    args: { traceId, limit: limit ?? null },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.requestAttemptLogsByTraceId(traceId, limit ?? null),
        (rows) => rows.map(toRequestAttemptLog)
      ),
  });
}
