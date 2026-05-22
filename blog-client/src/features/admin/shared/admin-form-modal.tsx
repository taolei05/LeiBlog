import {
  AlertDialog,
  Button,
  Description,
  FieldError,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import type { FormEvent, ReactNode } from "react";

import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";

type AdminFormModalProps = {
  children: ReactNode;
  confirmDescription?: string;
  confirmTitle?: string;
  confirmTone?: "danger" | "warning";
  description?: string;
  icon: AppIconName;
  isOpen: boolean;
  isSubmitting?: boolean;
  isBodyScrollable?: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: () => Promise<void> | void;
  size?: "sm" | "md" | "lg";
  submitLabel: string;
  title: string;
};

export function AdminFormModal({
  children,
  confirmDescription = "请确认表单内容无误后继续。",
  confirmTitle,
  confirmTone = "warning",
  description,
  icon,
  isOpen,
  isSubmitting = false,
  isBodyScrollable = false,
  onOpenChange,
  onSubmit,
  size = "md",
  submitLabel,
  title,
}: AdminFormModalProps) {
  const formClassName = isBodyScrollable
    ? "admin-form-modal admin-form-modal--scrollable"
    : "admin-form-modal";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container
        placement="center"
        scroll={isBodyScrollable ? "inside" : undefined}
        size={size}
      >
        <Modal.Dialog>
          <form className={formClassName} onSubmit={handleSubmit}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <AppIcon name={icon} />
              </Modal.Icon>
              <div>
                <Modal.Heading>{title}</Modal.Heading>
                {description ? (
                  <p className="admin-form-modal__description">{description}</p>
                ) : null}
              </div>
            </Modal.Header>
            <Modal.Body className="admin-form-modal__body">
              <div className="admin-form-modal__fields">{children}</div>
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => onOpenChange(false)} type="button" variant="tertiary">
                取消
              </Button>
              <AlertDialog>
                <Button isDisabled={isSubmitting} type="button" variant="primary">
                  {submitLabel}
                </Button>
                <AlertDialog.Backdrop>
                  <AlertDialog.Container placement="center" size="sm">
                    <AlertDialog.Dialog>
                      <AlertDialog.CloseTrigger />
                      <AlertDialog.Header>
                        <AlertDialog.Icon status={confirmTone} />
                        <AlertDialog.Heading>
                          {confirmTitle ?? `确认${submitLabel}？`}
                        </AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>
                        <p>{confirmDescription}</p>
                      </AlertDialog.Body>
                      <AlertDialog.Footer>
                        <Button slot="close" variant="tertiary">
                          取消
                        </Button>
                        <Button
                          isDisabled={isSubmitting}
                          onPress={() => {
                            void onSubmit();
                          }}
                          slot="close"
                          variant={confirmTone === "danger" ? "danger" : "primary"}
                        >
                          确认{submitLabel}
                        </Button>
                      </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                  </AlertDialog.Container>
                </AlertDialog.Backdrop>
              </AlertDialog>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

type AdminInputGroupFieldProps = {
  autoComplete?: string;
  description?: string;
  fieldError?: string;
  icon: AppIconName;
  isRequired?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "email" | "password" | "text" | "url";
  value: string;
};

export function AdminInputGroupField({
  autoComplete,
  description,
  fieldError,
  icon,
  isRequired = false,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: AdminInputGroupFieldProps) {
  const descriptionText = description ?? (isRequired ? "必填" : undefined);

  return (
    <TextField className="admin-form-modal__field" fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <InputGroup fullWidth variant="secondary">
        <InputGroup.Prefix>
          <AppIcon name={icon} size={16} />
        </InputGroup.Prefix>
        <InputGroup.Input
          autoComplete={autoComplete}
          className="admin-form-modal__input"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </InputGroup>
      {descriptionText ? <Description>{descriptionText}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

type AdminTextAreaGroupFieldProps = {
  description?: string;
  fieldError?: string;
  icon: AppIconName;
  isRequired?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
};

export function AdminTextAreaGroupField({
  description,
  fieldError,
  icon,
  isRequired = false,
  label,
  onChange,
  placeholder,
  rows = 4,
  value,
}: AdminTextAreaGroupFieldProps) {
  const descriptionText = description ?? (isRequired ? "必填" : undefined);

  return (
    <TextField className="admin-form-modal__field" fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <InputGroup fullWidth variant="secondary">
        <InputGroup.Prefix className="admin-form-modal__textarea-icon">
          <AppIcon name={icon} size={16} />
        </InputGroup.Prefix>
        <InputGroup.TextArea
          className="admin-form-modal__textarea"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      </InputGroup>
      {descriptionText ? <Description>{descriptionText}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

type AdminSelectGroupFieldProps = {
  icon: AppIconName;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
};

export function AdminSelectGroupField({
  icon,
  label,
  onChange,
  options,
  value,
}: AdminSelectGroupFieldProps) {
  return (
    <Select
      className="admin-form-modal__field"
      onChange={(nextValue) => {
        if (nextValue === null) return;
        onChange(String(nextValue));
      }}
      value={value}
      variant="secondary"
    >
      <Label>{label}</Label>
      <Select.Trigger className="admin-form-modal__select">
        <AppIcon name={icon} size={16} />
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={label}>
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
