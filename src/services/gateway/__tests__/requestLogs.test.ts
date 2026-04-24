import { describe, expect, it, vi } from "vitest";
import { commands } from "../../../generated/bindings";
import { logToConsole } from "../../consoleLog";
import { createRequestLogDetail } from "../requestLogFixtures";
import {
  type RequestAttemptLog,
  requestAttemptLogsByTraceId,
  requestLogGet,
  requestLogGetByTraceId,
  requestLogsList,
  requestLogsListAfterId,
  requestLogsListAfterIdAll,
  requestLogsListAll,
} from "../requestLogs";

vi.mock("../../../generated/bindings", async () => {
  const actual = await vi.importActual<typeof import("../../../generated/bindings")>(
    "../../../generated/bindings"
  );
  return {
    ...actual,
    commands: {
      ...actual.commands,
      requestLogsList: vi.fn(),
      requestLogsListAll: vi.fn(),
      requestLogsListAfterId: vi.fn(),
      requestLogsListAfterIdAll: vi.fn(),
      requestLogGet: vi.fn(),
      requestLogGetByTraceId: vi.fn(),
      requestAttemptLogsByTraceId: vi.fn(),
    },
  };
});

function makeRequestAttemptLog(overrides: Partial<RequestAttemptLog> = {}): RequestAttemptLog {
  return {
    id: 1,
    trace_id: "trace-1",
    cli_key: "claude",
    attempt_index: 0,
    provider_id: 1,
    provider_name: "Provider",
    base_url: "https://example.com",
    outcome: "success",
    status: 200,
    attempt_started_ms: 1,
    attempt_duration_ms: 2,
    created_at: 1,
    ...overrides,
  };
}

vi.mock("../../consoleLog", async () => {
  const actual = await vi.importActual<typeof import("../../consoleLog")>("../../consoleLog");
  return {
    ...actual,
    logToConsole: vi.fn(),
  };
});

describe("services/gateway/requestLogs", () => {
  it("rethrows invoke errors and logs", async () => {
    vi.mocked(commands.requestLogsList).mockRejectedValueOnce(new Error("request logs boom"));

    await expect(requestLogsList("claude", 10)).rejects.toThrow("request logs boom");
    expect(logToConsole).toHaveBeenCalledWith(
      "error",
      "读取请求日志失败",
      expect.objectContaining({
        cmd: "request_logs_list",
        error: expect.stringContaining("request logs boom"),
      })
    );
  });

  it("treats null invoke result as error with runtime", async () => {
    vi.mocked(commands.requestLogsList).mockResolvedValueOnce({
      status: "ok",
      data: null as never,
    });

    await expect(requestLogsList("claude", 10)).rejects.toThrow(
      "IPC_NULL_RESULT: request_logs_list"
    );
  });

  it("passes request logs command args with stable contract fields", async () => {
    vi.mocked(commands.requestLogsList).mockResolvedValueOnce({ status: "ok", data: [] });
    vi.mocked(commands.requestLogsListAll).mockResolvedValueOnce({ status: "ok", data: [] });
    vi.mocked(commands.requestLogsListAfterId).mockResolvedValueOnce({
      status: "ok",
      data: [],
    });
    vi.mocked(commands.requestLogsListAfterIdAll).mockResolvedValueOnce({
      status: "ok",
      data: [],
    });
    vi.mocked(commands.requestLogGet).mockResolvedValueOnce({
      status: "ok",
      data: createRequestLogDetail(),
    });
    vi.mocked(commands.requestLogGetByTraceId).mockResolvedValueOnce({
      status: "ok",
      data: null,
    });
    vi.mocked(commands.requestAttemptLogsByTraceId).mockResolvedValueOnce({
      status: "ok",
      data: [makeRequestAttemptLog()],
    });

    await requestLogsList("claude", 10);
    await requestLogsListAll(20);
    await requestLogsListAfterId("codex", 5, 30);
    await requestLogsListAfterIdAll(6, 40);
    await requestLogGet(1);
    await requestLogGetByTraceId("t1");
    await requestAttemptLogsByTraceId("t1", 99);

    expect(commands.requestLogsList).toHaveBeenCalledWith("claude", 10);
    expect(commands.requestLogsListAll).toHaveBeenCalledWith(20);
    expect(commands.requestLogsListAfterId).toHaveBeenCalledWith("codex", 5, 30);
    expect(commands.requestLogsListAfterIdAll).toHaveBeenCalledWith(6, 40);
    expect(commands.requestLogGet).toHaveBeenCalledWith(1);
    expect(commands.requestLogGetByTraceId).toHaveBeenCalledWith("t1");
    expect(commands.requestAttemptLogsByTraceId).toHaveBeenCalledWith("t1", 99);
  });
});
