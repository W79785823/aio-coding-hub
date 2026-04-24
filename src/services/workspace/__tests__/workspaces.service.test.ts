import { describe, expect, it, vi } from "vitest";
import { commands } from "../../../generated/bindings";
import { logToConsole } from "../../consoleLog";
import {
  workspaceCreate,
  workspaceDelete,
  workspaceRename,
  workspacesList,
  type WorkspaceSummary,
} from "../workspaces";

vi.mock("../../../generated/bindings", async () => {
  const actual = await vi.importActual<typeof import("../../../generated/bindings")>(
    "../../../generated/bindings"
  );
  return {
    ...actual,
    commands: {
      ...actual.commands,
      workspacesList: vi.fn(),
      workspaceCreate: vi.fn(),
      workspaceRename: vi.fn(),
      workspaceDelete: vi.fn(),
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

describe("services/workspace/workspaces", () => {
  function createWorkspaceSummary(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
    return {
      id: 1,
      cli_key: "claude",
      name: "W1",
      created_at: 0,
      updated_at: 0,
      ...overrides,
    };
  }

  it("rethrows invoke errors and logs", async () => {
    vi.mocked(commands.workspacesList).mockRejectedValueOnce(new Error("workspaces boom"));

    await expect(workspacesList("claude")).rejects.toThrow("workspaces boom");
    expect(logToConsole).toHaveBeenCalledWith(
      "error",
      "读取工作区列表失败",
      expect.objectContaining({
        cmd: "workspaces_list",
        error: expect.stringContaining("workspaces boom"),
      })
    );
  });

  it("treats null invoke result as error with runtime", async () => {
    vi.mocked(commands.workspacesList).mockResolvedValueOnce(null as never);

    await expect(workspacesList("claude")).rejects.toThrow("IPC_NULL_RESULT: workspaces_list");
  });

  it("keeps argument mapping unchanged", async () => {
    vi.mocked(commands.workspaceCreate).mockResolvedValue({
      status: "ok",
      data: createWorkspaceSummary(),
    });
    vi.mocked(commands.workspaceRename).mockResolvedValue({
      status: "ok",
      data: createWorkspaceSummary({ name: "W9" }),
    });
    vi.mocked(commands.workspaceDelete).mockResolvedValue({ status: "ok", data: true });

    await workspaceCreate({
      cliKey: "claude",
      name: "W1",
      cloneFromActive: true,
    });
    expect(commands.workspaceCreate).toHaveBeenCalledWith("claude", "W1", true);

    await workspaceRename({ workspaceId: 9, name: "W9" });
    expect(commands.workspaceRename).toHaveBeenCalledWith(9, "W9");

    await workspaceDelete(9);
    expect(commands.workspaceDelete).toHaveBeenCalledWith(9);
  });
});
