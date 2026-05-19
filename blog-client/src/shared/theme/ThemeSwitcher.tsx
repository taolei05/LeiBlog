import { Button } from "@heroui/react";

import type { AppIconName } from "../icons";
import type { ResolvedTheme } from "./ThemeProviderLite";
import { AppIcon } from "../icons";
import { useTheme } from "./ThemeProviderLite";

type ThemeSwitcherProps = {
  density?: "compact" | "roomy";
};

const themeModeMeta: Record<
  ResolvedTheme,
  {
    icon: AppIconName;
    label: string;
    nextLabel: string;
    nextMode: ResolvedTheme;
  }
> = {
  light: {
    icon: "sunny",
    label: "浅色",
    nextLabel: "深色",
    nextMode: "dark",
  },
  dark: {
    icon: "moon",
    label: "深色",
    nextLabel: "浅色",
    nextMode: "light",
  },
};

export function ThemeSwitcher({ density = "compact" }: ThemeSwitcherProps) {
  const { resolvedTheme, setMode } = useTheme();
  const currentMode = themeModeMeta[resolvedTheme];

  return (
    <Button
      aria-label={`当前为${currentMode.label}主题，切换到${currentMode.nextLabel}主题`}
      className={`theme-switcher theme-switcher--${density}`}
      onPress={() => setMode(currentMode.nextMode)}
      size={density === "roomy" ? "lg" : "md"}
      type="button"
      variant="secondary"
    >
      <AppIcon name={currentMode.icon} size={16} />
      <span>{currentMode.label}</span>
    </Button>
  );
}
