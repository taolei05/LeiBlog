import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { HomeHero } from "../src/features/blog/home/HomePage";

describe("HomeHero", () => {
  it("renders multiple homepage covers as carousel slides", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HomeHero
          author={null}
          siteInfo={
            {
              description: "站点描述",
              establishedAt: "2026-06-05T12:00:00.000Z",
              homeCoverUrls: [
                "https://cdn.example.com/cover-a.jpg",
                "https://cdn.example.com/cover-b.jpg",
              ],
              homeSlogan: "首页文案",
              siteName: "LeiBlog",
            } as never
          }
        />
      </MemoryRouter>,
    );

    expect(html).toContain("home-hero-showcase__slide");
    expect(html).toContain("https://cdn.example.com/cover-a.jpg");
    expect(html).toContain("https://cdn.example.com/cover-b.jpg");
    expect(html).toContain("封面 1 / 2");
    expect(html).toContain("封面 2 / 2");
  });
});
