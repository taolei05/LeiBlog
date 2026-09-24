import { defineConfig } from "vite-plus";
import type { Plugin } from "vite-plus";

const ENTRY_POINTS = {
  root: "index.html",
  admin: "admin/index.html",
} as const;

const ADMIN_HOME_PATH = "/admin";
const ADMIN_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LeiBlog Admin</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/admin/src/main.tsx"></script>
  </body>
</html>`;

const getPathname = (url: string) => url.split("?")[0] ?? "";

const getRequestStringField = (request: unknown, field: string) => {
  if (typeof request !== "object" || request === null) {
    return undefined;
  }

  const value = (request as Record<string, unknown>)[field];
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
};

const isAdminPageRequest = (url: string) => {
  const pathname = getPathname(url);

  if (pathname === ADMIN_HOME_PATH || pathname === `${ADMIN_HOME_PATH}/`) {
    return true;
  }

  if (!pathname.startsWith(`${ADMIN_HOME_PATH}/`)) {
    return false;
  }

  return !pathname.includes(".");
};

const adminHistoryFallbackPlugin = (): Plugin => ({
  name: "leiblog-admin-history-fallback",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const method = getRequestStringField(request, "method");
      if (method !== "GET" && method !== "HEAD") {
        next();
        return;
      }

      const requestUrl = getRequestStringField(request, "url");
      if (requestUrl === undefined || !isAdminPageRequest(requestUrl)) {
        next();
        return;
      }

      const html = await server.transformIndexHtml(requestUrl, ADMIN_INDEX_HTML);

      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html");
      response.end(method === "HEAD" ? undefined : html);
    });
  },
});

export default defineConfig({
  plugins: [adminHistoryFallbackPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      input: ENTRY_POINTS,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
