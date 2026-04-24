import {
  commands,
  type CliSessionsDisplayContentBlock,
  type CliSessionsDisplayMessage,
  type CliSessionsFolderLookupEntry as GeneratedCliSessionsFolderLookupEntry,
  type CliSessionsFolderLookupInput as GeneratedCliSessionsFolderLookupInput,
  type CliSessionsPaginatedMessages,
  type CliSessionsProjectSummary as GeneratedCliSessionsProjectSummary,
  type CliSessionsSessionSummary as GeneratedCliSessionsSessionSummary,
} from "../../generated/bindings";
import { invokeGeneratedIpc, mapGeneratedCommandResponse } from "../generatedIpc";
import { narrowGeneratedStringUnion, type Override } from "../generatedTypeUtils";

const CLI_SESSION_SOURCE_VALUES = ["claude", "codex"] as const;

export type CliSessionsSource = (typeof CLI_SESSION_SOURCE_VALUES)[number];

export type CliSessionsProjectSummary = Override<
  GeneratedCliSessionsProjectSummary,
  {
    source: CliSessionsSource;
  }
>;

export type CliSessionsSessionSummary = Override<
  GeneratedCliSessionsSessionSummary,
  {
    source: CliSessionsSource;
  }
>;

export type CliSessionsFolderLookupInput = Override<
  GeneratedCliSessionsFolderLookupInput,
  {
    source: CliSessionsSource;
  }
>;

export type CliSessionsFolderLookupEntry = Override<
  GeneratedCliSessionsFolderLookupEntry,
  {
    source: CliSessionsSource;
  }
>;

type CliSessionsMessagesCommandArgs = Parameters<typeof commands.cliSessionsMessagesGet>;
type CliSessionsSessionDeleteCommandArgs = Parameters<typeof commands.cliSessionsSessionDelete>;

export type CliSessionsMessagesInput = {
  source: CliSessionsSource;
  filePath: CliSessionsMessagesCommandArgs[1];
  page: CliSessionsMessagesCommandArgs[2];
  pageSize: CliSessionsMessagesCommandArgs[3];
  fromEnd: CliSessionsMessagesCommandArgs[4];
  wslDistro?: Exclude<CliSessionsMessagesCommandArgs[5], undefined>;
};

export type CliSessionsSessionDeleteInput = {
  source: CliSessionsSource;
  filePaths: CliSessionsSessionDeleteCommandArgs[1];
  wslDistro?: Exclude<CliSessionsSessionDeleteCommandArgs[2], undefined>;
};

function toCliSessionsSource(value: string, label: string): CliSessionsSource {
  return narrowGeneratedStringUnion(value, CLI_SESSION_SOURCE_VALUES, label);
}

function toCliSessionsProjectSummary(
  value: GeneratedCliSessionsProjectSummary
): CliSessionsProjectSummary {
  return {
    ...value,
    source: toCliSessionsSource(value.source, "cli_sessions_projects_list.source"),
  };
}

function toCliSessionsSessionSummary(
  value: GeneratedCliSessionsSessionSummary
): CliSessionsSessionSummary {
  return {
    ...value,
    source: toCliSessionsSource(value.source, "cli_sessions_sessions_list.source"),
  };
}

function toCliSessionsFolderLookupEntry(
  value: GeneratedCliSessionsFolderLookupEntry
): CliSessionsFolderLookupEntry {
  return {
    ...value,
    source: toCliSessionsSource(value.source, "cli_sessions_folder_lookup_by_ids.source"),
  };
}

export async function cliSessionsProjectsList(source: CliSessionsSource, wslDistro?: string) {
  return invokeGeneratedIpc<CliSessionsProjectSummary[]>({
    title: "读取会话项目列表失败",
    cmd: "cli_sessions_projects_list",
    args: {
      source,
      wslDistro: wslDistro ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.cliSessionsProjectsList(source, wslDistro ?? null),
        (rows) => rows.map(toCliSessionsProjectSummary)
      ),
  });
}

export async function cliSessionsSessionsList(
  source: CliSessionsSource,
  projectId: string,
  wslDistro?: string
) {
  return invokeGeneratedIpc<CliSessionsSessionSummary[]>({
    title: "读取会话列表失败",
    cmd: "cli_sessions_sessions_list",
    args: {
      source,
      projectId,
      wslDistro: wslDistro ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.cliSessionsSessionsList(source, projectId, wslDistro ?? null),
        (rows) => rows.map(toCliSessionsSessionSummary)
      ),
  });
}

export async function cliSessionsMessagesGet(input: CliSessionsMessagesInput) {
  return invokeGeneratedIpc<CliSessionsPaginatedMessages>({
    title: "读取会话消息失败",
    cmd: "cli_sessions_messages_get",
    args: {
      source: input.source,
      filePath: input.filePath,
      page: input.page,
      pageSize: input.pageSize,
      fromEnd: input.fromEnd,
      wslDistro: input.wslDistro ?? null,
    },
    invoke: () =>
      commands.cliSessionsMessagesGet(
        input.source,
        input.filePath,
        input.page,
        input.pageSize,
        input.fromEnd,
        input.wslDistro ?? null
      ),
  });
}

export async function cliSessionsSessionDelete(input: CliSessionsSessionDeleteInput) {
  return invokeGeneratedIpc<string[]>({
    title: "删除会话失败",
    cmd: "cli_sessions_session_delete",
    args: {
      source: input.source,
      filePaths: input.filePaths,
      wslDistro: input.wslDistro ?? null,
    },
    invoke: () =>
      commands.cliSessionsSessionDelete(input.source, input.filePaths, input.wslDistro ?? null),
  });
}

export async function cliSessionsFolderLookupByIds(
  items: CliSessionsFolderLookupInput[],
  wslDistro?: string
) {
  return invokeGeneratedIpc<CliSessionsFolderLookupEntry[]>({
    title: "读取会话文件夹信息失败",
    cmd: "cli_sessions_folder_lookup_by_ids",
    args: {
      items,
      wslDistro: wslDistro ?? null,
    },
    invoke: async () =>
      mapGeneratedCommandResponse(
        await commands.cliSessionsFolderLookupByIds(items, wslDistro ?? null),
        (rows) => rows.map(toCliSessionsFolderLookupEntry)
      ),
  });
}

/**
 * Escapes a shell argument for safe command execution across platforms.
 *
 * - Windows: Uses double quotes and escapes internal double quotes by doubling them
 * - Unix/Linux/macOS: Uses single quotes and escapes internal single quotes with '\''
 *
 * This prevents shell injection attacks when building commands with user-provided input.
 *
 * @param arg - The argument string to escape
 * @returns The escaped argument safe for shell execution
 *
 * @example
 * // Windows: escapeShellArg('hello "world"') => '"hello ""world"""'
 * // Unix: escapeShellArg("it's fine") => '\'it'\''s fine\''
 */
export function escapeShellArg(arg: string): string {
  // Detect platform using navigator (browser environment)
  const isWindows = typeof navigator !== "undefined" && /Win/.test(navigator.userAgent);

  // Handle empty string
  if (arg === "") {
    return isWindows ? '""' : "''";
  }

  // Windows: Use double quotes, escape internal double quotes by doubling them
  if (isWindows) {
    return `"${arg.replace(/"/g, '""')}"`;
  }

  // Unix-like systems: Use single quotes, escape single quotes with '\''
  // The pattern '\'' ends the current quote, adds an escaped single quote, and starts a new quote
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export type {
  CliSessionsDisplayContentBlock,
  CliSessionsDisplayMessage,
  CliSessionsPaginatedMessages,
};
