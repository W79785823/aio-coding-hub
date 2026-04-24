import {
  commands,
  type WorkspaceApplyReport as GeneratedWorkspaceApplyReport,
  type WorkspacePreview as GeneratedWorkspacePreview,
  type WorkspaceSummary as GeneratedWorkspaceSummary,
  type WorkspacesListResult as GeneratedWorkspacesListResult,
} from "../../generated/bindings";
import {
  invokeGeneratedIpc,
  mapGeneratedCommandResponse,
  type GeneratedCommandResult,
} from "../generatedIpc";
import type { CliKey } from "../providers/providers";
import { narrowGeneratedStringUnion, type Override } from "../generatedTypeUtils";

const CLI_KEY_VALUES = ["claude", "codex", "gemini"] as const satisfies readonly CliKey[];

export type WorkspaceSummary = Override<
  GeneratedWorkspaceSummary,
  {
    cli_key: CliKey;
  }
>;

export type WorkspacesListResult = Override<
  GeneratedWorkspacesListResult,
  {
    items: WorkspaceSummary[];
  }
>;

export type WorkspaceCreateInput = {
  cliKey: CliKey;
  name: string;
  cloneFromActive?: boolean;
};

export type WorkspaceRenameInput = {
  workspaceId: number;
  name: string;
};

export type WorkspacePreview = Override<
  GeneratedWorkspacePreview,
  {
    cli_key: CliKey;
  }
>;

export type WorkspaceApplyReport = Override<
  GeneratedWorkspaceApplyReport,
  {
    cli_key: CliKey;
  }
>;

function toCliKey(value: string, label: string): CliKey {
  return narrowGeneratedStringUnion(value, CLI_KEY_VALUES, label);
}

function toWorkspaceSummary(value: GeneratedWorkspaceSummary): WorkspaceSummary {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "workspaces.cli_key"),
  };
}

function toWorkspacesListResult(value: GeneratedWorkspacesListResult): WorkspacesListResult {
  return {
    ...value,
    items: value.items.map(toWorkspaceSummary),
  };
}

function toWorkspacePreview(value: GeneratedWorkspacePreview): WorkspacePreview {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "workspace_preview.cli_key"),
  };
}

function toWorkspaceApplyReport(value: GeneratedWorkspaceApplyReport): WorkspaceApplyReport {
  return {
    ...value,
    cli_key: toCliKey(value.cli_key, "workspace_apply.cli_key"),
  };
}

export async function workspacesList(cliKey: CliKey) {
  return invokeGeneratedIpc<WorkspacesListResult>({
    title: "读取工作区列表失败",
    cmd: "workspaces_list",
    args: { cliKey },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.workspacesList(cliKey), toWorkspacesListResult),
  });
}

export async function workspaceCreate(input: WorkspaceCreateInput) {
  return invokeGeneratedIpc<WorkspaceSummary>({
    title: "创建工作区失败",
    cmd: "workspace_create",
    args: {
      cliKey: input.cliKey,
      name: input.name,
      cloneFromActive: input.cloneFromActive ?? false,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.workspaceCreate(input.cliKey, input.name, input.cloneFromActive ?? false),
        toWorkspaceSummary
      ),
  });
}

export async function workspaceRename(input: WorkspaceRenameInput) {
  return invokeGeneratedIpc<WorkspaceSummary>({
    title: "重命名工作区失败",
    cmd: "workspace_rename",
    args: {
      workspaceId: input.workspaceId,
      name: input.name,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.workspaceRename(input.workspaceId, input.name),
        toWorkspaceSummary
      ),
  });
}

export async function workspaceDelete(workspaceId: number) {
  return invokeGeneratedIpc<boolean>({
    title: "删除工作区失败",
    cmd: "workspace_delete",
    args: { workspaceId },
    invoke: () => commands.workspaceDelete(workspaceId) as Promise<GeneratedCommandResult<boolean>>,
  });
}

export async function workspacePreview(workspaceId: number) {
  return invokeGeneratedIpc<WorkspacePreview>({
    title: "读取工作区预览失败",
    cmd: "workspace_preview",
    args: { workspaceId },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.workspacePreview(workspaceId), toWorkspacePreview),
  });
}

export async function workspaceApply(workspaceId: number) {
  return invokeGeneratedIpc<WorkspaceApplyReport>({
    title: "应用工作区失败",
    cmd: "workspace_apply",
    args: { workspaceId },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.workspaceApply(workspaceId),
        toWorkspaceApplyReport
      ),
  });
}
