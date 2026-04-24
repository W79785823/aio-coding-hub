// Usage:
// - Query adapters for `src/services/mcp.ts`, used by MCP pages/views.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mcpImportFromWorkspaceCli,
  mcpImportServers,
  type McpImportServer,
  type McpImportReport,
  type McpSecretPatchInput,
  mcpServerDelete,
  mcpServerSetEnabled,
  mcpServerUpsert,
  mcpServersList,
  type McpServerSummary,
  type McpTransport,
} from "../services/workspace/mcp";
import { mcpKeys } from "./keys";

export function useMcpServersListQuery(
  workspaceId: number | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: mcpKeys.serversList(workspaceId),
    queryFn: () => {
      if (!workspaceId) return null;
      return mcpServersList(workspaceId);
    },
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useMcpServerUpsertMutation(workspaceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      serverId: number | null;
      serverKey: string;
      name: string;
      transport: McpTransport;
      command: string | null;
      args: string[];
      env?: McpSecretPatchInput;
      cwd: string | null;
      url: string | null;
      headers?: McpSecretPatchInput;
    }) => mcpServerUpsert(input),
    onSuccess: (next) => {
      queryClient.setQueryData<McpServerSummary[]>(mcpKeys.serversList(workspaceId), (cur) => {
        const prev = cur ?? [];
        const exists = prev.some((s) => s.id === next.id);
        if (exists) return prev.map((s) => (s.id === next.id ? next : s));
        return [next, ...prev];
      });
    },
  });
}

export function useMcpServerSetEnabledMutation(workspaceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { serverId: number; enabled: boolean }) =>
      mcpServerSetEnabled({
        workspaceId,
        serverId: input.serverId,
        enabled: input.enabled,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData<McpServerSummary[]>(mcpKeys.serversList(workspaceId), (cur) =>
        (cur ?? []).map((s) => (s.id === next.id ? next : s))
      );
    },
  });
}

export function useMcpServerDeleteMutation(workspaceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: number) => mcpServerDelete(serverId),
    onSuccess: (ok, serverId) => {
      if (!ok) return;
      queryClient.setQueryData<McpServerSummary[]>(mcpKeys.serversList(workspaceId), (cur) =>
        (cur ?? []).filter((s) => s.id !== serverId)
      );
    },
  });
}

export function useMcpImportServersMutation(workspaceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (servers: McpImportServer[]) => mcpImportServers({ workspaceId, servers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serversList(workspaceId) });
    },
  });
}

export function useMcpImportFromWorkspaceCliMutation(workspaceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => mcpImportFromWorkspaceCli(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.serversList(workspaceId) });
    },
  });
}

export type { McpImportReport, McpImportServer };
