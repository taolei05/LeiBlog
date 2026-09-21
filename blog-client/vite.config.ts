import { defineConfig } from "vite-plus";

const ENTRY_POINTS = {
  root: "index.html",
  admin: "admin/index.html",
} as const;

export default defineConfig({
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
