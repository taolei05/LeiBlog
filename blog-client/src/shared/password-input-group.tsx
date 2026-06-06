import { Button, InputGroup } from "@heroui/react";
import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";

import { AppIcon } from "./icons";

type PasswordInputGroupProps = {
  autoComplete?: string;
  className?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  prefix?: ReactNode;
  value: string;
  variant?: "primary" | "secondary";
};

export function PasswordInputGroup({
  autoComplete,
  className,
  onChange,
  placeholder,
  prefix,
  value,
  variant = "primary",
}: PasswordInputGroupProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <InputGroup fullWidth variant={variant}>
      {prefix ? <InputGroup.Prefix>{prefix}</InputGroup.Prefix> : null}
      <InputGroup.Input
        autoComplete={autoComplete}
        className={className}
        onChange={onChange}
        placeholder={placeholder}
        type={isVisible ? "text" : "password"}
        value={value}
      />
      <InputGroup.Suffix className="pr-0">
        <Button
          aria-label={isVisible ? "隐藏密码" : "显示密码"}
          isIconOnly
          onPress={() => setIsVisible((visible) => !visible)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <AppIcon name={isVisible ? "eye" : "eyeOff"} size={16} />
        </Button>
      </InputGroup.Suffix>
    </InputGroup>
  );
}
