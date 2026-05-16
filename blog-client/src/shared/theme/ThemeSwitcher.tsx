import { Button } from "@heroui/react";

import { AppIcon, type AppIconName } from "../icons";
import { themeModes, type ThemeMode } from "./ThemeProviderLite";
import { useTheme } from "./ThemeProviderLite";

type ThemeSwitcherProps = {
  density?: "compact" | "roomy";
};

const themeModeMeta: Record<
  ThemeMode,
  {
    description: string;
    icon: AppIconName;
    label: string;
  }
> = {
  system: {
    description: "跟随系统外观",
    icon: "desktop",
    label: "系统",
  },
  light: {
    description: "切换到浅色主题",
    icon: "sunny",
    label: "浅色",
  },
  dark: {
    description: "切换到深色主题",
    icon: "moon",
    label: "深色",
  },
};

export function ThemeSwitcher({ density = "compact" }: ThemeSwitcherProps) {
  const { mode, resolvedTheme, setMode } = useTheme();
  const currentMode = themeModeMeta[mode];

  return (
    <div
      aria-label={`主题切换，当前为${currentMode.label}，实际显示${resolvedTheme === "dark" ? "深色" : "浅色"}`}
      className={`theme-switcher theme-switcher--${density}`}
      role="group"
    >
      {themeModes.map((themeMode) => {
        const item = themeModeMeta[themeMode];
        const isActive = mode === themeMode;

        return (
          <Button
            aria-label={item.description}
            aria-pressed={isActive}
            className="theme-switcher__button"
            key={themeMode}
            onPress={() => setMode(themeMode)}
            size="sm"
            variant={isActive ? "primary" : "tertiary"}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
