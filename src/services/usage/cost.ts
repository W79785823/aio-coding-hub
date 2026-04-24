// Usage:
// - Used by `src/components/home/HomeCostPanel.tsx` to load cost analytics for the Home "花费" tab.

import {
  commands,
  type CostBackfillReportV1,
  type CostModelBreakdownRowV1,
  type CostProviderBreakdownRowV1 as GeneratedCostProviderBreakdownRowV1,
  type CostQueryParams as GeneratedCostQueryParams,
  type CostScatterCliProviderModelRowV1 as GeneratedCostScatterCliProviderModelRowV1,
  type CostSummaryV1,
  type CostTopRequestRowV1 as GeneratedCostTopRequestRowV1,
  type CostTrendRowV1,
} from "../../generated/bindings";
import { invokeGeneratedIpc, mapGeneratedCommandResponse } from "../generatedIpc";
import {
  narrowGeneratedStringUnion,
  type OptionalNullableGeneratedFields,
  type Override,
} from "../generatedTypeUtils";
import type { CliKey } from "../providers/providers";

const CLI_KEY_VALUES = ["claude", "codex", "gemini"] as const satisfies readonly CliKey[];

export type CostPeriod = "daily" | "weekly" | "monthly" | "allTime" | "custom";

export type CostProviderBreakdownRowV1 = Override<
  GeneratedCostProviderBreakdownRowV1,
  {
    cli_key: CliKey;
  }
>;

export type CostScatterCliProviderModelRowV1 = Override<
  GeneratedCostScatterCliProviderModelRowV1,
  {
    cli_key: CliKey;
  }
>;

export type CostTopRequestRowV1 = Override<
  GeneratedCostTopRequestRowV1,
  {
    cli_key: CliKey;
  }
>;

type CostQueryInput = Omit<OptionalNullableGeneratedFields<GeneratedCostQueryParams>, "period">;

function buildParams(period: CostPeriod, input?: CostQueryInput): GeneratedCostQueryParams {
  return {
    period,
    startTs: input?.startTs ?? null,
    endTs: input?.endTs ?? null,
    cliKey: input?.cliKey ?? null,
    providerId: input?.providerId ?? null,
    model: input?.model ?? null,
  };
}

function toCliKey(value: string, label: string): CliKey {
  return narrowGeneratedStringUnion(value, CLI_KEY_VALUES, label);
}

function toCostProviderBreakdownRowV1(
  value: GeneratedCostProviderBreakdownRowV1
): CostProviderBreakdownRowV1 {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "cost_breakdown_provider_v1.cli_key"),
  };
}

function toCostScatterCliProviderModelRowV1(
  value: GeneratedCostScatterCliProviderModelRowV1
): CostScatterCliProviderModelRowV1 {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "cost_scatter_cli_provider_model_v1.cli_key"),
  };
}

function toCostTopRequestRowV1(value: GeneratedCostTopRequestRowV1): CostTopRequestRowV1 {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "cost_top_requests_v1.cli_key"),
  };
}

export async function costSummaryV1(period: CostPeriod, input?: CostQueryInput) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostSummaryV1>({
    title: "读取花费汇总失败",
    cmd: "cost_summary_v1",
    args: { params },
    invoke: () => commands.costSummaryV1(params),
  });
}

export async function costTrendV1(period: CostPeriod, input?: CostQueryInput) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostTrendRowV1[]>({
    title: "读取花费趋势失败",
    cmd: "cost_trend_v1",
    args: { params },
    invoke: () => commands.costTrendV1(params),
  });
}

export async function costBreakdownProviderV1(
  period: CostPeriod,
  input?: CostQueryInput & { limit?: number | null }
) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostProviderBreakdownRowV1[]>({
    title: "读取按供应商花费分布失败",
    cmd: "cost_breakdown_provider_v1",
    args: {
      params,
      limit: input?.limit ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.costBreakdownProviderV1(params, input?.limit ?? null),
        (rows) => rows.map(toCostProviderBreakdownRowV1)
      ),
  });
}

export async function costBreakdownModelV1(
  period: CostPeriod,
  input?: CostQueryInput & { limit?: number | null }
) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostModelBreakdownRowV1[]>({
    title: "读取按模型花费分布失败",
    cmd: "cost_breakdown_model_v1",
    args: {
      params,
      limit: input?.limit ?? null,
    },
    invoke: () => commands.costBreakdownModelV1(params, input?.limit ?? null),
  });
}

export async function costTopRequestsV1(
  period: CostPeriod,
  input?: CostQueryInput & { limit?: number | null }
) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostTopRequestRowV1[]>({
    title: "读取高花费请求失败",
    cmd: "cost_top_requests_v1",
    args: {
      params,
      limit: input?.limit ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.costTopRequestsV1(params, input?.limit ?? null),
        (rows) => rows.map(toCostTopRequestRowV1)
      ),
  });
}

export async function costScatterCliProviderModelV1(
  period: CostPeriod,
  input?: CostQueryInput & { limit?: number | null }
) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostScatterCliProviderModelRowV1[]>({
    title: "读取花费散点数据失败",
    cmd: "cost_scatter_cli_provider_model_v1",
    args: {
      params,
      limit: input?.limit ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.costScatterCliProviderModelV1(params, input?.limit ?? null),
        (rows) => rows.map(toCostScatterCliProviderModelRowV1)
      ),
  });
}

export async function costBackfillMissingV1(
  period: CostPeriod,
  input?: CostQueryInput & { maxRows?: number | null }
) {
  const params = buildParams(period, input);
  return invokeGeneratedIpc<CostBackfillReportV1>({
    title: "回填花费数据失败",
    cmd: "cost_backfill_missing_v1",
    args: {
      params,
      maxRows: input?.maxRows ?? null,
    },
    invoke: () => commands.costBackfillMissingV1(params, input?.maxRows ?? null),
  });
}

export type { CostBackfillReportV1, CostModelBreakdownRowV1, CostSummaryV1, CostTrendRowV1 };
