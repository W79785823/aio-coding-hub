import {
  commands,
  type ModelPriceAliasMatchTypeV1 as GeneratedModelPriceAliasMatchType,
  type ModelPriceAliasesV1 as GeneratedModelPriceAliases,
  type ModelPriceAliasRuleV1 as GeneratedModelPriceAliasRule,
  type ModelPriceSummary as GeneratedModelPriceSummary,
  type ModelPricesSyncReport,
} from "../../generated/bindings";
import { invokeGeneratedIpc, mapGeneratedCommandResponse } from "../generatedIpc";
import { narrowGeneratedStringUnion, type Override } from "../generatedTypeUtils";
import type { CliKey } from "../providers/providers";

type Listener = () => void;

const listeners = new Set<Listener>();
const CLI_KEY_VALUES = ["claude", "codex", "gemini"] as const satisfies readonly CliKey[];

function emitUpdated() {
  for (const listener of listeners) listener();
}

export function subscribeModelPricesUpdated(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyModelPricesUpdated() {
  emitUpdated();
}

let _lastSyncedAt: number | null = null;
let _lastSyncReport: ModelPricesSyncReport | null = null;

export function setLastModelPricesSync(report: ModelPricesSyncReport) {
  _lastSyncedAt = Date.now();
  _lastSyncReport = report;
  emitUpdated();
}

export function getLastModelPricesSync(): {
  syncedAt: number | null;
  report: ModelPricesSyncReport | null;
} {
  return { syncedAt: _lastSyncedAt, report: _lastSyncReport };
}

export type ModelPriceAliasMatchType = GeneratedModelPriceAliasMatchType;

export type ModelPriceAliasRule = Override<
  GeneratedModelPriceAliasRule,
  {
    cli_key: CliKey;
    match_type: ModelPriceAliasMatchType;
  }
>;

export type ModelPriceAliases = Override<
  GeneratedModelPriceAliases,
  {
    rules: ModelPriceAliasRule[];
  }
>;

export type ModelPriceSummary = Override<
  GeneratedModelPriceSummary,
  {
    cli_key: CliKey;
  }
>;

function toCliKey(value: string, label: string): CliKey {
  return narrowGeneratedStringUnion(value, CLI_KEY_VALUES, label);
}

function toModelPriceAliasRule(value: GeneratedModelPriceAliasRule): ModelPriceAliasRule {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "model_price_aliases.rule.cli_key"),
  };
}

function toModelPriceAliases(value: GeneratedModelPriceAliases): ModelPriceAliases {
  return {
    ...value,
    rules: value.rules.map(toModelPriceAliasRule),
  };
}

function toModelPriceSummary(value: GeneratedModelPriceSummary): ModelPriceSummary {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "model_prices_list.cli_key"),
  };
}

export async function modelPricesList(cliKey: CliKey) {
  return invokeGeneratedIpc<ModelPriceSummary[]>({
    title: "读取模型价格列表失败",
    cmd: "model_prices_list",
    args: { cliKey },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.modelPricesList(cliKey), (rows) =>
        rows.map(toModelPriceSummary)
      ),
  });
}

export async function modelPricesSyncBasellm(force = false) {
  return invokeGeneratedIpc<ModelPricesSyncReport>({
    title: "同步模型价格失败",
    cmd: "model_prices_sync_basellm",
    args: { force },
    invoke: () => commands.modelPricesSyncBasellm(force),
  });
}

export async function modelPriceAliasesGet() {
  return invokeGeneratedIpc<ModelPriceAliases>({
    title: "读取模型别名规则失败",
    cmd: "model_price_aliases_get",
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.modelPriceAliasesGet(), toModelPriceAliases),
  });
}

export async function modelPriceAliasesSet(aliases: ModelPriceAliases) {
  return invokeGeneratedIpc<ModelPriceAliases>({
    title: "保存模型别名规则失败",
    cmd: "model_price_aliases_set",
    args: { aliases },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.modelPriceAliasesSet(aliases),
        toModelPriceAliases
      ),
  });
}

export type { ModelPricesSyncReport };
