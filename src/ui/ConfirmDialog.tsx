// Usage: Reusable confirmation dialog with cancel/confirm buttons.

import { Button, type ButtonProps } from "./Button";
import { Dialog } from "./Dialog";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmingLabel: string;
  confirming: boolean;
  disabled?: boolean;
  /** Button variant for the confirm action. Defaults to "primary". */
  confirmVariant?: ButtonProps["variant"];
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel,
  confirmingLabel,
  confirming,
  disabled = false,
  confirmVariant = "primary",
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      className="max-w-lg"
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <div className="space-y-3">
        {children}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant={confirmVariant} disabled={disabled || confirming} onClick={onConfirm}>
            {confirming ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
