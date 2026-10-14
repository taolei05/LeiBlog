import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "vite-plus";
import type { Plugin, ProxyOptions } from "vite-plus";

const httpsCert = process.env.LEIBLOG_DEV_HTTPS_CERT;
const httpsKey = process.env.LEIBLOG_DEV_HTTPS_KEY;
if (Boolean(httpsCert) !== Boolean(httpsKey)) {
  throw new Error("Local HTTPS requires both LEIBLOG_DEV_HTTPS_CERT and LEIBLOG_DEV_HTTPS_KEY.");
}
const useHttps = Boolean(httpsCert && httpsKey);
const caPath = join(homedir(), ".local", "share", "leiblog", "dev-https", "ca", "rootCA.pem");

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

const localCertificateDownloadPlugin = (): Plugin => ({
  name: "leiblog-local-certificate-download",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (
        !["GET", "HEAD"].includes(request.method ?? "") ||
        getPathname(request.url ?? "") !== "/__dev/leiblog-local-ca.crt"
      ) {
        next();
        return;
      }
      try {
        // Re-encode only the public certificate; never serve PEM contents or adjacent keys.
        const certificate = new X509Certificate(readFileSync(caPath));
        response.setHeader("Content-Type", "application/x-x509-ca-cert");
        response.setHeader("Content-Disposition", 'attachment; filename="leiblog-local-ca.crt"');
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(request.method === "HEAD" ? undefined : certificate.raw);
      } catch {
        response.statusCode = 404;
        response.end("Local development certificate is not available.");
      }
    });
  },
});

const developmentApiProxy: ProxyOptions = {
  target: "http://127.0.0.1:3000",
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest, request) => {
      const ip = request.socket.remoteAddress;
      for (const header of [
        "X-Forwarded-For",
        "X-Real-IP",
        "X-Leiblog-Country-Code",
        "CF-Connecting-IP",
        "CF-IPCountry",
      ]) {
        proxyRequest.removeHeader(header);
      }
      if (ip !== undefined) {
        proxyRequest.setHeader("X-Forwarded-For", ip);
        proxyRequest.setHeader("X-Real-IP", ip);
      }
      proxyRequest.setHeader("X-Forwarded-Proto", useHttps ? "https" : "http");
    });
  },
};

export default defineConfig({
  plugins: [adminHistoryFallbackPlugin(), localCertificateDownloadPlugin()],
  server: {
    host: "0.0.0.0",
    port: useHttps ? 5175 : 5174,
    strictPort: true,
    https:
      httpsCert && httpsKey
        ? { cert: readFileSync(httpsCert), key: readFileSync(httpsKey) }
        : undefined,
    proxy: {
      "/api": developmentApiProxy,
      "/uploads": developmentApiProxy,
    },
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
    overrides: [
      {
        files: ["shared/themes/neutral/neutral.d.ts"],
        rules: { "typescript/triple-slash-reference": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
});
