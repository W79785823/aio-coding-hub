import {
  commands,
  type DefaultPromptSyncItem as GeneratedDefaultPromptSyncItem,
  type DefaultPromptSyncReport as GeneratedDefaultPromptSyncReport,
  type PromptSummary as GeneratedPromptSummary,
} from "../../generated/bindings";
import {
  invokeGeneratedIpc,
  mapGeneratedCommandResponse,
  type GeneratedCommandResult,
} from "../generatedIpc";
import type { CliKey } from "../providers/providers";
import { narrowGeneratedStringUnion, type Override } from "../generatedTypeUtils";

const CLI_KEY_VALUES = ["claude", "codex", "gemini"] as const satisfies readonly CliKey[];
const DEFAULT_PROMPT_SYNC_ACTION_VALUES = [
  "created",
  "updated",
  "unchanged",
  "skipped",
  "error",
] as const;

export type PromptSummary = Override<
  GeneratedPromptSummary,
  {
    cli_key: CliKey;
  }
>;

export type DefaultPromptSyncAction = (typeof DEFAULT_PROMPT_SYNC_ACTION_VALUES)[number];

export type DefaultPromptSyncItem = Override<
  GeneratedDefaultPromptSyncItem,
  {
    cli_key: CliKey;
    action: DefaultPromptSyncAction;
  }
>;

export type DefaultPromptSyncReport = Override<
  GeneratedDefaultPromptSyncReport,
  {
    items: DefaultPromptSyncItem[];
  }
>;

export type PromptUpsertInput = {
  promptId?: number | null;
  workspaceId: number;
  name: string;
  content: string;
  enabled: boolean;
};

function toCliKey(value: string, label: string): CliKey {
  return narrowGeneratedStringUnion(value, CLI_KEY_VALUES, label);
}

function toDefaultPromptSyncAction(value: string, label: string): DefaultPromptSyncAction {
  return narrowGeneratedStringUnion(value, DEFAULT_PROMPT_SYNC_ACTION_VALUES, label);
}

function toPromptSummary(value: GeneratedPromptSummary): PromptSummary {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "prompts_list.cli_key"),
  };
}

function toDefaultPromptSyncItem(value: GeneratedDefaultPromptSyncItem): DefaultPromptSyncItem {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "prompts_default_sync_from_files.cli_key"),
    action: toDefaultPromptSyncAction(value.action, "prompts_default_sync_from_files.action"),
  };
}

function toDefaultPromptSyncReport(
  value: GeneratedDefaultPromptSyncReport
): DefaultPromptSyncReport {
  return {
    ...value,
    items: value.items.map(toDefaultPromptSyncItem),
  };
}

export async function promptsList(workspaceId: number) {
  return invokeGeneratedIpc<PromptSummary[]>({
    title: "读取提示词列表失败",
    cmd: "prompts_list",
    args: { workspaceId },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.promptsList(workspaceId), (rows) =>
        rows.map(toPromptSummary)
      ),
  });
}

export async function promptsDefaultSyncFromFiles() {
  return invokeGeneratedIpc<DefaultPromptSyncReport>({
    title: "同步默认提示词失败",
    cmd: "prompts_default_sync_from_files",
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.promptsDefaultSyncFromFiles(),
        toDefaultPromptSyncReport
      ),
  });
}

export async function promptUpsert(input: PromptUpsertInput) {
  return invokeGeneratedIpc<PromptSummary>({
    title: "保存提示词失败",
    cmd: "prompt_upsert",
    args: {
      promptId: input.promptId ?? null,
      workspaceId: input.workspaceId,
      name: input.name,
      content: input.content,
      enabled: input.enabled,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.promptUpsert(
          input.promptId ?? null,
          input.workspaceId,
          input.name,
          input.content,
          input.enabled
        ),
        toPromptSummary
      ),
  });
}

export async function promptSetEnabled(promptId: number, enabled: boolean) {
  return invokeGeneratedIpc<PromptSummary>({
    title: "更新提示词启用状态失败",
    cmd: "prompt_set_enabled",
    args: {
      promptId,
      enabled,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.promptSetEnabled(promptId, enabled),
        toPromptSummary
      ),
  });
}

export async function promptDelete(promptId: number) {
  return invokeGeneratedIpc<boolean>({
    title: "删除提示词失败",
    cmd: "prompt_delete",
    args: { promptId },
    invoke: () => commands.promptDelete(promptId) as Promise<GeneratedCommandResult<boolean>>,
  });
}
