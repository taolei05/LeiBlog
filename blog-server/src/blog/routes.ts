import { Elysia } from "elysia";

export const blogRoutes = new Elysia({ prefix: "/api/blog" }).get("/health", () => ({
  ok: true,
  scope: "blog",
}));
