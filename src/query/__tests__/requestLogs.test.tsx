import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestAttemptLogsByTraceId,
  requestLogGet,
  requestLogsListAfterIdAll,
  requestLogsListAll,
  type RequestLogSummary,
} from "../../services/gateway/requestLogs";
import {
  createRequestLogDetail,
  createRequestLogSummary as createRequestLogSummaryFixture,
} from "../../services/gateway/requestLogFixtures";
import { createQueryWrapper, createTestQueryClient } from "../../test/utils/reactQuery";
import { setTauriRuntime } from "../../test/utils/tauriRuntime";
import { requestLogsKeys } from "../keys";
import {
  useRequestAttemptLogsByTraceIdQuery,
  useRequestLogDetailQuery,
  useRequestLogsIncrementalRefreshMutation,
  useRequestLogsListAllQuery,
} from "../requestLogs";

vi.mock("../../services/gateway/requestLogs", async () => {
  const actual = await vi.importActual<typeof import("../../services/gateway/requestLogs")>(
    "../../services/gateway/requestLogs"
  );
  return {
    ...actual,
    requestLogsListAll: vi.fn(),
    requestLogsListAfterIdAll: vi.fn(),
    requestLogGet: vi.fn(),
    requestAttemptLogsByTraceId: vi.fn(),
  };
});

function makeRequestLogSummary(
  overrides: Parameters<typeof createRequestLogSummaryFixture>[0] = {}
): RequestLogSummary {
  const hasTimestampOverride = "created_at" in overrides || "created_at_ms" in overrides;
  return createRequestLogSummaryFixture({
    ...(hasTimestampOverride ? {} : { created_at_ms: 10_000, created_at: 10 }),
    ...overrides,
  });
}

describe("query/requestLogs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls requestLogsListAll with tauri runtime", async () => {
    setTauriRuntime();

    vi.mocked(requestLogsListAll).mockResolvedValue([]);

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useRequestLogsListAllQuery(10), { wrapper });

    await waitFor(() => {
      expect(requestLogsListAll).toHaveBeenCalledWith(10);
    });
  });

  it("passes through rows from the backend list-all query", async () => {
    setTauriRuntime();

    vi.mocked(requestLogsListAll).mockResolvedValue([
      makeRequestLogSummary({ id: 1, path: "/v1/messages", created_at: 10 }),
      makeRequestLogSummary({ id: 2, path: "/v1/messages", created_at: 11 }),
    ]);

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useRequestLogsListAllQuery(10), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.map((row) => row.id)).toEqual([1, 2]);
    });
  });

  it("useRequestLogsListAllQuery enters error state when requestLogsListAll rejects", async () => {
    setTauriRuntime();

    vi.mocked(requestLogsListAll).mockRejectedValue(new Error("request logs query boom"));

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useRequestLogsListAllQuery(10), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("respects options.enabled=false", async () => {
    setTauriRuntime();

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useRequestLogsListAllQuery(10, { enabled: false }), { wrapper });
    await Promise.resolve();

    expect(requestLogsListAll).not.toHaveBeenCalled();
  });

  it("does not call requestLogGet when logId is null (even on manual refetch)", async () => {
    setTauriRuntime();

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useRequestLogDetailQuery(null), { wrapper });
    await act(async () => {
      const res = await result.current.refetch();
      expect(res.data).toBeNull();
    });

    expect(requestLogGet).not.toHaveBeenCalled();
  });

  it("calls requestLogGet when logId is provided", async () => {
    setTauriRuntime();

    vi.mocked(requestLogGet).mockResolvedValue(createRequestLogDetail());

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useRequestLogDetailQuery(1), { wrapper });

    await waitFor(() => {
      expect(requestLogGet).toHaveBeenCalledWith(1);
    });
  });

  it("does not call requestAttemptLogsByTraceId when traceId is null (even on manual refetch)", async () => {
    setTauriRuntime();

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useRequestAttemptLogsByTraceIdQuery(null, 10), { wrapper });
    await act(async () => {
      const res = await result.current.refetch();
      expect(res.data).toBeNull();
    });

    expect(requestAttemptLogsByTraceId).not.toHaveBeenCalled();
  });

  it("calls requestAttemptLogsByTraceId when traceId is provided", async () => {
    setTauriRuntime();

    vi.mocked(requestAttemptLogsByTraceId).mockResolvedValue([]);

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useRequestAttemptLogsByTraceIdQuery("trace-1", 10), { wrapper });

    await waitFor(() => {
      expect(requestAttemptLogsByTraceId).toHaveBeenCalledWith("trace-1", 10);
    });
  });

  it("incremental refresh mutation keeps backend rows and cache stable on empty incremental items", async () => {
    setTauriRuntime();

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const listKey = requestLogsKeys.listAll(10);

    vi.mocked(requestLogsListAll).mockResolvedValueOnce([
      makeRequestLogSummary({ id: 1, created_at: 9, created_at_ms: null }),
      makeRequestLogSummary({ id: 2, created_at: 10, created_at_ms: null }),
    ]);
    const { result } = renderHook(() => useRequestLogsIncrementalRefreshMutation(10), { wrapper });

    await act(async () => {
      const res = await result.current.mutateAsync();
      expect(res?.mode).toBe("full");
      expect(res?.items?.map((row) => row.id)).toEqual([1, 2]);
    });
    expect((client.getQueryData<RequestLogSummary[]>(listKey) ?? []).map((row) => row.id)).toEqual([
      2, 1,
    ]);

    client.setQueryData(listKey, [makeRequestLogSummary({ id: 5, created_at: 10 })]);
    vi.mocked(requestLogsListAfterIdAll).mockResolvedValueOnce([
      makeRequestLogSummary({ id: 6, created_at: 11 }),
      makeRequestLogSummary({ id: 7, created_at: 12 }),
    ]);
    await act(async () => {
      const res = await result.current.mutateAsync();
      expect(res?.mode).toBe("incremental");
      expect(res?.items?.map((row) => row.id)).toEqual([6, 7]);
    });
    expect(
      (client.getQueryData<RequestLogSummary[]>(listKey) ?? []).some((row) => row.id === 6)
    ).toBe(true);
    expect(
      (client.getQueryData<RequestLogSummary[]>(listKey) ?? []).some((row) => row.id === 7)
    ).toBe(true);

    const nowSec2 = Math.floor(Date.now() / 1000);
    client.setQueryData(listKey, [
      makeRequestLogSummary({ id: 8, status: null, error_code: null, created_at: nowSec2 }),
    ]);
    vi.mocked(requestLogsListAll).mockResolvedValueOnce([
      makeRequestLogSummary({ id: 8, status: 200, error_code: null, created_at: nowSec2 }),
    ]);
    await act(async () => {
      const res = await result.current.mutateAsync();
      expect(res?.mode).toBe("full");
      expect(res?.items?.map((row) => row.id)).toEqual([8]);
    });
    expect((client.getQueryData<RequestLogSummary[]>(listKey) ?? [])[0]?.status).toBe(200);

    vi.mocked(requestLogsListAfterIdAll).mockResolvedValueOnce([]);
    await act(async () => {
      const res = await result.current.mutateAsync();
      expect(res?.mode).toBe("incremental");
      expect(res?.items).toEqual([]);
    });
    expect(
      (client.getQueryData<RequestLogSummary[]>(listKey) ?? []).some((row) => row.id === 8)
    ).toBe(true);
  });
});
