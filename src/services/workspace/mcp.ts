import {
  commands,
  type McpImportReport,
  type McpImportServer as GeneratedMcpImportServer,
  type McpParseResult as GeneratedMcpParseResult,
  type McpSecretPatchInput as GeneratedMcpSecretPatchInput,
  type McpServerSummaryView as GeneratedMcpServerSummaryView,
  type McpServerUpsertInput as GeneratedMcpServerUpsertInput,
} from "../../generated/bindings";
import { invokeGeneratedIpc, mapGeneratedCommandResponse } from "../generatedIpc";
import {
  narrowGeneratedStringUnion,
  type OptionalNullableGeneratedFields,
  type Override,
} from "../generatedTypeUtils";

const MCP_TRANSPORT_VALUES = ["stdio", "http", "sse"] as const;

export type McpTransport = (typeof MCP_TRANSPORT_VALUES)[number];

export type McpServerSummary = Override<
  GeneratedMcpServerSummaryView,
  {
    transport: McpTransport;
  }
>;

export type McpSecretPatchInput =
  | OptionalNullableGeneratedFields<GeneratedMcpSecretPatchInput>
  | Record<string, string>;

type McpServerUpsertTransportInput = OptionalNullableGeneratedFields<GeneratedMcpServerUpsertInput>;

export type McpServerUpsertInput = Override<
  McpServerUpsertTransportInput,
  {
    transport: McpTransport;
    env?: McpSecretPatchInput;
    headers?: McpSecretPatchInput;
  }
>;

export type McpImportServer = Override<
  GeneratedMcpImportServer,
  {
    transport: McpTransport;
  }
>;

export type McpParseResult = Override<
  GeneratedMcpParseResult,
  {
    servers: McpImportServer[];
  }
>;

type McpSecretPatchDraft = OptionalNullableGeneratedFields<GeneratedMcpSecretPatchInput>;

function toMcpTransport(value: string, label: string): McpTransport {
  return narrowGeneratedStringUnion(value, MCP_TRANSPORT_VALUES, label);
}

function normalizeSecretPatchInput(
  input: McpSecretPatchInput | undefined
): GeneratedMcpSecretPatchInput {
  if (!input) {
    return {
      preserveKeys: [],
      replace: {},
    };
  }

  const patchInput = input as McpSecretPatchDraft;
  const hasPatchShape =
    Array.isArray(patchInput.preserveKeys) ||
    (patchInput.replace != null &&
      typeof patchInput.replace === "object" &&
      !Array.isArray(patchInput.replace));

  if (hasPatchShape) {
    return {
      preserveKeys: patchInput.preserveKeys ?? [],
      replace: patchInput.replace ?? {},
    };
  }

  return {
    preserveKeys: [],
    replace: input,
  };
}

function buildSafeSecretPatchLog(patch: GeneratedMcpSecretPatchInput) {
  return {
    preserveKeys: patch.preserveKeys ?? [],
    replaceKeys: Object.keys(patch.replace ?? {}),
  };
}

function toMcpServerSummary(value: GeneratedMcpServerSummaryView): McpServerSummary {
  return {
    ...value,
    transport: toMcpTransport(value.transport, "mcp_server.transport"),
  };
}

function toMcpImportServer(value: GeneratedMcpImportServer): McpImportServer {
  return {
    ...value,
    transport: toMcpTransport(value.transport, "mcp_import_server.transport"),
  };
}

function toMcpParseResult(value: GeneratedMcpParseResult): McpParseResult {
  return {
    ...value,
    servers: value.servers.map(toMcpImportServer),
  };
}

export async function mcpServersList(workspaceId: number) {
  return invokeGeneratedIpc<McpServerSummary[]>({
    title: "读取 MCP 服务列表失败",
    cmd: "mcp_servers_list",
    args: { input: { workspaceId } },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.mcpServersList({ workspaceId }), (rows) =>
        rows.map(toMcpServerSummary)
      ),
  });
}

export async function mcpServerUpsert(input: McpServerUpsertInput) {
  const normalizedEnv = normalizeSecretPatchInput(input.env);
  const normalizedHeaders = normalizeSecretPatchInput(input.headers);
  const payload: GeneratedMcpServerUpsertInput = {
    serverId: input.serverId ?? null,
    serverKey: input.serverKey,
    name: input.name,
    transport: input.transport,
    command: input.command ?? null,
    args: input.args ?? [],
    env: normalizedEnv,
    cwd: input.cwd ?? null,
    url: input.url ?? null,
    headers: normalizedHeaders,
  };

  return invokeGeneratedIpc<McpServerSummary>({
    title: "保存 MCP 服务失败",
    cmd: "mcp_server_upsert",
    args: {
      input: {
        serverId: payload.serverId,
        serverKey: payload.serverKey,
        name: payload.name,
        transport: payload.transport,
        command: payload.command,
        args: payload.args,
        cwd: payload.cwd,
        url: payload.url,
        env: buildSafeSecretPatchLog(normalizedEnv),
        headers: buildSafeSecretPatchLog(normalizedHeaders),
      },
    },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.mcpServerUpsert(payload), toMcpServerSummary),
  });
}

export async function mcpServerSetEnabled(input: {
  workspaceId: number;
  serverId: number;
  enabled: boolean;
}) {
  const payload = {
    workspaceId: input.workspaceId,
    serverId: input.serverId,
    enabled: input.enabled,
  };

  return invokeGeneratedIpc<McpServerSummary>({
    title: "更新 MCP 服务启用状态失败",
    cmd: "mcp_server_set_enabled",
    args: { input: payload },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.mcpServerSetEnabled(payload), toMcpServerSummary),
  });
}

export async function mcpServerDelete(serverId: number) {
  return invokeGeneratedIpc<boolean>({
    title: "删除 MCP 服务失败",
    cmd: "mcp_server_delete",
    args: { input: { serverId } },
    invoke: () => commands.mcpServerDelete({ serverId }),
  });
}

export async function mcpParseJson(jsonText: string) {
  return invokeGeneratedIpc<McpParseResult>({
    title: "解析 MCP JSON 失败",
    cmd: "mcp_parse_json",
    args: { input: { jsonText } },
    invoke: async () =>
      mapGeneratedCommandResponse(await commands.mcpParseJson({ jsonText }), toMcpParseResult),
  });
}

export async function mcpImportServers(input: { workspaceId: number; servers: McpImportServer[] }) {
  const payload = {
    workspaceId: input.workspaceId,
    servers: input.servers,
  };

  return invokeGeneratedIpc<McpImportReport>({
    title: "导入 MCP 服务失败",
    cmd: "mcp_import_servers",
    args: { input: payload },
    invoke: () => commands.mcpImportServers(payload),
  });
}

export async function mcpImportFromWorkspaceCli(workspaceId: number) {
  return invokeGeneratedIpc<McpImportReport>({
    title: "从工作区 CLI 导入 MCP 服务失败",
    cmd: "mcp_import_from_workspace_cli",
    args: { input: { workspaceId } },
    invoke: () => commands.mcpImportFromWorkspaceCli({ workspaceId }),
  });
}

export type { McpImportReport };
