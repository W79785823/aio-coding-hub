import { describe, expect, it, vi } from "vitest";
import { commands } from "../../../generated/bindings";
import { logToConsole } from "../../consoleLog";
import { providerLimitUsageV1, type ProviderLimitUsageRow } from "../providerLimitUsage";

vi.mock("../../../generated/bindings", async () => {
  const actual = await vi.importActual<typeof import("../../../generated/bindings")>(
    "../../../generated/bindings"
  );
  return {
    ...actual,
    commands: {
      ...actual.commands,
      providerLimitUsageV1: vi.fn(),
    },
  };
});

function makeProviderLimitUsageRow(
  overrides: Partial<ProviderLimitUsageRow> = {}
): ProviderLimitUsageRow {
  return {
    cli_key: "claude",
    provider_id: 1,
    provider_name: "Fetch",
    enabled: true,
    limit_5h_usd: null,
    limit_daily_usd: null,
    daily_reset_mode: null,
    daily_reset_time: null,
    limit_weekly_usd: null,
    limit_monthly_usd: null,
    limit_total_usd: null,
    usage_5h_usd: 0,
    usage_daily_usd: 0,
    usage_weekly_usd: 0,
    usage_monthly_usd: 0,
    usage_total_usd: 0,
    window_5h_start_ts: 0,
    window_daily_start_ts: 0,
    window_weekly_start_ts: 0,
    window_monthly_start_ts: 0,
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

describe("services/providers/providerLimitUsage", () => {
  it("rethrows invoke errors and logs", async () => {
    vi.mocked(commands.providerLimitUsageV1).mockRejectedValueOnce(
      new Error("provider limit boom")
    );

    await expect(providerLimitUsageV1("claude")).rejects.toThrow("provider limit boom");
    expect(logToConsole).toHaveBeenCalledWith(
      "error",
      "读取 Provider 限额用量失败",
      expect.objectContaining({
        cmd: "provider_limit_usage_v1",
        error: expect.stringContaining("provider limit boom"),
      })
    );
  });

  it("maps generated rows and forwards nullable cliKey", async () => {
    vi.mocked(commands.providerLimitUsageV1)
      .mockResolvedValueOnce({
        status: "ok",
        data: [makeProviderLimitUsageRow()],
      })
      .mockResolvedValueOnce({ status: "ok", data: [] });

    const rows = await providerLimitUsageV1("claude");
    const allRows = await providerLimitUsageV1(null);

    expect(rows?.[0]?.cli_key).toBe("claude");
    expect(allRows).toEqual([]);
    expect(commands.providerLimitUsageV1).toHaveBeenNthCalledWith(1, "claude");
    expect(commands.providerLimitUsageV1).toHaveBeenNthCalledWith(2, null);
  });
});
