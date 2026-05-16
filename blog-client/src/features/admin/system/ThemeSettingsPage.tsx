import { Button, Card } from "@heroui/react";
import { useState, type CSSProperties } from "react";
import { zhCN } from "date-fns/locale/zh-CN";
import { DayPicker, TZDate } from "react-day-picker";

import { AppIcon, type AppIconName } from "../../../shared/icons";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../../shared/theme/ThemeProviderLite";

const timeZone = "Asia/Shanghai";

const tokenGroups = [
  {
    title: "界面基础",
    description: "全局背景、前景、层级表面和遮罩。",
    icon: "contrast",
    tokens: [
      { name: "--background", label: "页面背景" },
      { name: "--foreground", label: "正文前景" },
      { name: "--surface", label: "基础表面" },
      { name: "--surface-secondary", label: "次级表面" },
      { name: "--overlay", label: "弹层背景" },
      { name: "--backdrop", label: "遮罩" },
    ],
  },
  {
    title: "交互状态",
    description: "强调色、链接、焦点和业务状态色。",
    icon: "colorPalette",
    tokens: [
      { name: "--accent", label: "强调色" },
      { name: "--accent-soft", label: "强调弱底" },
      { name: "--link", label: "链接" },
      { name: "--focus", label: "焦点" },
      { name: "--success", label: "成功" },
      { name: "--warning", label: "警告" },
      { name: "--danger", label: "危险" },
    ],
  },
  {
    title: "结构边界",
    description: "边框、分隔线、表单字段和滚动条。",
    icon: "radioButtonOn",
    tokens: [
      { name: "--border", label: "主边框" },
      { name: "--border-secondary", label: "次边框" },
      { name: "--separator", label: "分隔线" },
      { name: "--field-background", label: "字段背景" },
      { name: "--field-border", label: "字段边框" },
      { name: "--scrollbar", label: "滚动条" },
    ],
  },
] as const;

const integrationItems: Array<{
  description: string;
  icon: AppIconName;
  title: string;
  tokens: string[];
}> = [
  {
    title: "DayPicker",
    description: "日期控件使用同一强调色、弱底色和字段圆角，固定上海时区。",
    icon: "calendar",
    tokens: [
      "--rdp-accent-color",
      "--rdp-accent-background-color",
      "--rdp-day_button-border-radius",
    ],
  },
  {
    title: "MDXEditor",
    description: "编辑器的 Radix 色彩别名映射到 HeroUI 语义 token。",
    icon: "codeSlash",
    tokens: ["--accentSolid", "--baseBg", "--baseBorder", "--admonitionInfoBg"],
  },
];

export function ThemeSettingsPage() {
  const { mode, resolvedTheme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => TZDate.tz(timeZone));

  return (
    <section className="page-stack theme-page">
      <div className="page-heading page-heading--compact">
        <p className="eyebrow">阶段 2</p>
        <h2>主题系统</h2>
        <p>
          当前阶段先接好主题内核、完整
          token、三态切换和编辑器占位，后续系统设置会扩展为可保存的主题表单。
        </p>
      </div>

      <Card className="theme-editor-card theme-editor-card--hero">
        <div className="theme-editor-card__body">
          <div className="theme-editor-card__copy">
            <AppIcon name="sparkles" size={24} />
            <div>
              <Card.Header>
                <Card.Title>主题编辑器占位</Card.Title>
                <Card.Description>
                  前台和后台共享 ThemeProviderLite，实际主题由 `data-theme`、`data-theme-mode` 和
                  CSS 变量驱动。
                </Card.Description>
              </Card.Header>
            </div>
          </div>
          <div className="theme-editor-card__actions">
            <ThemeSwitcher density="roomy" />
            <div className="theme-current-state" aria-label="当前主题状态">
              <span>当前模式</span>
              <strong>{mode === "system" ? "跟随系统" : mode === "dark" ? "深色" : "浅色"}</strong>
              <span>解析为 {resolvedTheme === "dark" ? "深色" : "浅色"}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="theme-token-grid">
        {tokenGroups.map((group) => (
          <Card className="theme-token-card" key={group.title}>
            <Card.Header>
              <Card.Title>
                <AppIcon name={group.icon} />
                {group.title}
              </Card.Title>
              <Card.Description>{group.description}</Card.Description>
            </Card.Header>
            <div className="theme-token-list">
              {group.tokens.map((token) => (
                <div className="theme-token-row" key={token.name}>
                  <span
                    aria-hidden="true"
                    className="theme-token-swatch"
                    style={{ background: `var(${token.name})` }}
                  />
                  <span>{token.label}</span>
                  <code>{token.name}</code>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="theme-preview-grid">
        <Card className="theme-preview-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="calendar" />
              DayPicker 变量预览
            </Card.Title>
            <Card.Description>
              使用 `timeZone=&quot;Asia/Shanghai&quot;`，样式变量已接入主题 token。
            </Card.Description>
          </Card.Header>
          <div className="theme-calendar-preview">
            <DayPicker
              animate
              locale={zhCN}
              mode="single"
              onSelect={(date) => setSelectedDate(date)}
              selected={selectedDate}
              timeZone={timeZone}
            />
          </div>
        </Card>

        <Card className="theme-preview-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="codeSlash" />
              MDXEditor 变量预览
            </Card.Title>
            <Card.Description>
              先用公开 class 呈现编辑器外观，阶段 6 再接入完整插件链。
            </Card.Description>
          </Card.Header>
          <div
            aria-label="MDXEditor 主题变量预览"
            className="mdxeditor theme-mdx-preview"
            style={{ "--basePageBg": "var(--surface)" } as CSSProperties}
          >
            <div className="mdxeditor-toolbar theme-mdx-preview__toolbar">
              <Button size="sm" variant="tertiary">
                <AppIcon name="brush" />
                正文
              </Button>
              <Button size="sm" variant="tertiary">
                <AppIcon name="codeSlash" />
                代码
              </Button>
            </div>
            <div className="mdxeditor-root-contenteditable theme-mdx-preview__content">
              <h3>编辑器主题占位</h3>
              <p>工具栏、内容区、提示块和代码字体都从主题变量继承。</p>
              <pre>
                <code>{`const theme = "shared tokens";`}</code>
              </pre>
            </div>
          </div>
        </Card>
      </div>

      <div className="theme-integration-list">
        {integrationItems.map((item) => (
          <Card className="theme-integration-card" key={item.title}>
            <Card.Header>
              <Card.Title>
                <AppIcon name={item.icon} />
                {item.title}
              </Card.Title>
              <Card.Description>{item.description}</Card.Description>
            </Card.Header>
            <div className="theme-integration-card__tokens">
              {item.tokens.map((token) => (
                <code key={token}>{token}</code>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
