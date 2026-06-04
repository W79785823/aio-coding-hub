import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../Dialog";

describe("ui/Dialog", () => {
  it("uses a compact default width that callers can override", () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <Dialog open={true} title="Title" description="Desc" onOpenChange={onOpenChange}>
        <div>Body</div>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-lg");
    expect(dialog).toHaveClass("pointer-events-auto");
    expect(document.querySelector(".pointer-events-none")).not.toBeNull();

    rerender(
      <Dialog
        open={true}
        title="Title"
        description="Desc"
        onOpenChange={onOpenChange}
        className="max-w-3xl"
      >
        <div>Body</div>
      </Dialog>
    );

    expect(screen.getByRole("dialog")).toHaveClass("max-w-3xl");
    expect(screen.getByRole("dialog")).not.toHaveClass("max-w-lg");
  });

  it("renders description when provided and omits it otherwise", () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <Dialog open={true} title="Title" description="Desc" onOpenChange={onOpenChange}>
        <div>Body</div>
      </Dialog>
    );

    expect(screen.getByText("Desc")).toBeInTheDocument();

    rerender(
      <Dialog open={true} title="Title" onOpenChange={onOpenChange}>
        <div>Body</div>
      </Dialog>
    );

    expect(screen.queryByText("Desc")).toBeNull();
  });
});
