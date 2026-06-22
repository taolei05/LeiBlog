import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import blogLayoutSource from "../src/app/blog/BlogLayout.tsx?raw";
import interactiveCursorSource from "../src/app/blog/InteractiveCursor.tsx?raw";
import routerSource from "../src/app/router.tsx?raw";
import navigationPageSource from "../src/features/blog/navigation/NavigationPage.tsx?raw";
import { NavigationPage } from "../src/features/blog/navigation/NavigationPage";
import { normalizeNavigationGroups } from "../src/features/blog/navigation/navigation-api";

const navigationStyles = readFileSync(
  new URL("../src/shared/theme/navigation.css", import.meta.url),
  "utf8",
);

const fixtureGroups = [
  {
    id: "tools",
    items: [
      {
        iconUrl: null,
        id: "caniuse",
        name: "Can I use",
        note: "前端 API 兼容性查询",
        url: "https://caniuse.com",
      },
    ],
    name: "常用工具",
  },
];

describe("public navigation page", () => {
  it("filters empty groups and resolves icon assets", () => {
    const groups = normalizeNavigationGroups({
      groups: [
        ...fixtureGroups,
        { id: "empty", items: [], name: "空分组" },
        {
          id: "icons",
          items: [
            {
              iconUrl: "/uploads/website-icons/icon.png",
              id: "icon-item",
              name: "图标网站",
              note: null,
              url: "https://icons.example.com",
            },
          ],
          name: "图标",
        },
      ],
    });

    expect(groups.map((group) => group.name)).toEqual(["常用工具", "图标"]);
    expect(groups[1]?.items[0]?.iconUrl).toContain("/uploads/website-icons/icon.png");
  });

  it("renders safe external cards and the desktop directory", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NavigationPage initialGroups={fixtureGroups} />
      </MemoryRouter>,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="导航页目录"');
    expect(html).toContain("前端 API 兼容性查询");
    expect(html).not.toContain("空分组");
  });

  it("uses arrow tooltips to expose full website notes", () => {
    expect(navigationPageSource).toContain("Popover, Tooltip");
    expect(navigationPageSource).toContain("Tooltip.Content");
    expect(navigationPageSource).toContain("Tooltip.Trigger");
    expect(navigationPageSource).toContain("role: _role");
    expect(navigationPageSource).toContain("isOpen={isTooltipOpen}");
    expect(navigationPageSource).toContain("onOpenChange={setIsTooltipOpen}");
    expect(navigationPageSource).toContain("onPointerEnter");
    expect(navigationPageSource).toContain("onPointerLeave");
    expect(navigationPageSource).toContain("onFocus");
    expect(navigationPageSource).toContain("onBlur");
    expect(navigationPageSource).toContain("showArrow");
    expect(navigationPageSource).toContain("Tooltip.Arrow");
    expect(navigationPageSource).toContain("navigation-page__note-tooltip");
    expect(navigationPageSource).toContain("NavigationSiteIcon");
    expect(navigationPageSource).toContain('referrerPolicy="no-referrer"');
    expect(navigationPageSource).toContain("setHasIconError(true)");
    expect(navigationPageSource).not.toContain("Link,");
    expect(navigationPageSource).not.toContain("onMouseEnter");
  });

  it("renders a mobile directory trigger and popover", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NavigationPage initialGroups={fixtureGroups} />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="打开导航目录"');
    expect(html).toContain("navigation-page__mobile-directory");
    expect(navigationPageSource).toContain("navigation-page__mobile-directory-popover");
    expect(navigationPageSource).toContain("本页目录");
  });

  it("wires a top-level navigation entry and public route", () => {
    expect(blogLayoutSource).toContain('{ to: "/navigation", label: "导航页"');
    expect(routerSource).toContain('path="navigation"');
  });

  it("uses restrained Interactive Cursor feedback across navigation surfaces", () => {
    expect(interactiveCursorSource).toContain('".navigation-admin-row"');
    expect(navigationStyles).toContain(
      "transform: translate3d(var(--cursor-pull-x, 0), var(--cursor-pull-y, 0), 0);",
    );
    expect(navigationStyles).toContain(".navigation-page__card:focus-visible");
    expect(navigationStyles).toContain(".navigation-admin-row:focus-within");
    expect(navigationStyles).toContain(
      '.interactive-shell--cursor-active .navigation-admin-row[draggable="true"]',
    );
    expect(navigationStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps navigation surfaces rounded independently from the compact global radius", () => {
    expect(navigationStyles).toContain("--navigation-surface-radius: 1rem;");
    expect(navigationStyles).toContain("--navigation-item-radius: 0.75rem;");
    expect(navigationStyles).toContain("border-radius: var(--navigation-surface-radius);");
    expect(navigationStyles).toContain("border-radius: var(--navigation-item-radius);");
  });
});
