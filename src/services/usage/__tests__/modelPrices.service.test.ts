import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../../../generated/bindings";
import { logToConsole } from "../../consoleLog";
import {
  type ModelPriceAliases,
  type ModelPriceSummary,
  type ModelPricesSyncReport,
  modelPriceAliasesGet,
  modelPriceAliasesSet,
  modelPricesList,
  modelPricesSyncBasellm,
} from "../modelPrices";

vi.mock("../../../generated/bindings", async () => {
  const actual = await vi.importActual<typeof import("../../../generated/bindings")>(
    "../../../generated/bindings"
  );
  return {
    ...actual,
    commands: {
      ...actual.commands,
      modelPricesList: vi.fn(),
      modelPricesSyncBasellm: vi.fn(),
      modelPriceAliasesGet: vi.fn(),
      modelPriceAliasesSet: vi.fn(),
    },
  };
});

vi.mock("../../consoleLog", async () => {
  const actual = await vi.importActual<typeof import("../../consoleLog")>("../../consoleLog");
  return {
    ...actual,
    logToConsole: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeModelPriceSummary(overrides: Partial<ModelPriceSummary> = {}): ModelPriceSummary {
  return {
    id: 1,
    cli_key: "claude",
    model: "claude-3-7-sonnet",
    currency: "USD",
    created_at: 1,
    updated_at: 2,
    ...overrides,
  };
}

function makeModelPriceAliases(overrides: Partial<ModelPriceAliases> = {}): ModelPriceAliases {
  return {
    version: 1,
    rules: [
      {
        cli_key: "codex",
        match_type: "prefix",
        pattern: "gpt-",
        target_model: "gpt-5",
        enabled: true,
      },
    ],
    ...overrides,
  };
}

function makeModelPricesSyncReport(
  overrides: Partial<ModelPricesSyncReport> = {}
): ModelPricesSyncReport {
  return {
    status: "updated",
    inserted: 1,
    updated: 0,
    skipped: 0,
    total: 1,
    ...overrides,
  };
}

describe("services/usage/modelPrices", () => {
  it("rethrows invoke errors and logs", async () => {
    vi.mocked(commands.modelPricesList).mockRejectedValueOnce(new Error("model prices boom"));

    await expect(modelPricesList("claude")).rejects.toThrow("model prices boom");
    expect(logToConsole).toHaveBeenCalledWith(
      "error",
      "读取模型价格列表失败",
      expect.objectContaining({
        cmd: "model_prices_list",
        error: expect.stringContaining("model prices boom"),
      })
    );
  });

  it("maps generated list and alias payloads through generated authority", async () => {
    vi.mocked(commands.modelPricesList).mockResolvedValueOnce({
      status: "ok",
      data: [makeModelPriceSummary()],
    });
    vi.mocked(commands.modelPriceAliasesGet).mockResolvedValueOnce({
      status: "ok",
      data: makeModelPriceAliases(),
    });
    vi.mocked(commands.modelPriceAliasesSet).mockResolvedValueOnce({
      status: "ok",
      data: makeModelPriceAliases({ version: 2 }),
    });
    vi.mocked(commands.modelPricesSyncBasellm).mockResolvedValueOnce({
      status: "ok",
      data: makeModelPricesSyncReport(),
    });

    const rows = await modelPricesList("claude");
    const aliases = await modelPriceAliasesGet();
    const updated = await modelPriceAliasesSet(aliases!);
    const report = await modelPricesSyncBasellm(true);

    expect(rows?.[0]?.cli_key).toBe("claude");
    expect(aliases?.rules[0]?.cli_key).toBe("codex");
    expect(updated?.version).toBe(2);
    expect(report).toEqual(expect.objectContaining({ status: "updated", inserted: 1, total: 1 }));
    expect(commands.modelPricesList).toHaveBeenCalledWith("claude");
    expect(commands.modelPriceAliasesSet).toHaveBeenCalledWith(aliases);
    expect(commands.modelPricesSyncBasellm).toHaveBeenCalledWith(true);
  });
});
