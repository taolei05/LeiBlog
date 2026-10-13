import type { PropsWithChildren, ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

type AdminFormDialogProps = PropsWithChildren<{
  cancelLabel: string;
  closeLabel: string;
  description: ReactNode;
  isNarrow: boolean;
  isPrimaryDisabled?: boolean;
  isPrimaryLoading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  primaryIcon?: ReactNode;
  primaryLabel: string;
  title: string;
  width?: number;
}>;

export function AdminFormDialog({
  cancelLabel,
  children,
  closeLabel,
  description,
  isNarrow,
  isPrimaryDisabled = false,
  isPrimaryLoading = false,
  onClose,
  onSubmit,
  primaryIcon,
  primaryLabel,
  title,
  width = 1040,
}: AdminFormDialogProps) {
  return (
    <Dialog
      aria-label={title}
      isOpen
      maxHeight="90dvh"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      padding={0}
      variant={isNarrow ? "fullscreen" : "standard"}
      width={width}
    >
      <VStack className="admin-form-dialog" gap={0}>
        <HStack className="admin-form-dialog__header" gap={3} hAlign="between" vAlign="start">
          <VStack className="admin-form-dialog__title" gap={1}>
            <Heading level={2}>{title}</Heading>
            <Text type="supporting" color="secondary">
              {description}
            </Text>
          </VStack>
          <IconButton icon={<X size={16} />} label={closeLabel} onClick={onClose} variant="ghost" />
        </HStack>

        <VStack className="admin-form-dialog__body" gap={4}>
          {children}
        </VStack>

        <HStack className="admin-form-dialog__footer" gap={2} hAlign="end" wrap="wrap">
          <Button label={cancelLabel} onClick={onClose} variant="ghost" />
          <Button
            icon={primaryIcon}
            isDisabled={isPrimaryDisabled}
            isLoading={isPrimaryLoading}
            label={primaryLabel}
            onClick={onSubmit}
            variant="primary"
          />
        </HStack>
      </VStack>
    </Dialog>
  );
}
