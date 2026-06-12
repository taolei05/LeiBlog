import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import blogLayoutSource from "../src/app/blog/BlogLayout.tsx?raw";
import routerSource from "../src/app/router.tsx?raw";
import { NavigationPage } from "../src/features/blog/navigation/NavigationPage";
import { normalizeNavigationGroups } from "../src/features/blog/navigation/navigation-api";

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

  it("wires a top-level navigation entry and public route", () => {
    expect(blogLayoutSource).toContain('{ to: "/navigation", label: "导航页"');
    expect(routerSource).toContain('path="navigation"');
  });
});
