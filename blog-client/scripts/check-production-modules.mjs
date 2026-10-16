import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(process.argv[2] ?? "dist");
const assets = path.join(root, "assets");
const html = await readFile(path.join(root, "admin/index.html"), "utf8");
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (entry === undefined) throw new Error("Admin entry was not found.");
const files = (await readdir(assets)).filter((file) => file.endsWith(".js"));
const management = [];
const subscriptions = [];
for (const file of files) {
  const source = await readFile(path.join(assets, file), "utf8");
  if (source.includes("as ContentManagementPage")) {
    management.push(file);
  }
  if (source.includes("as SubscriptionsPage")) subscriptions.push(file);
}
if (management.length !== 1) throw new Error("Content management module was not found.");
if (subscriptions.length !== 1) throw new Error("Subscriptions module was not found.");

// Evaluate real production modules without Node's Prism global or rendering a UI.
const element = () => ({
  relList: { supports: () => true },
  style: {},
  setAttribute() {},
  appendChild() {},
  remove() {},
  querySelectorAll: () => [],
});
const document = {
  createElement: element,
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
  readyState: "loading",
  documentElement: element(),
  head: element(),
  body: element(),
};
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  document,
  Element: class {},
  HTMLElement: class {},
  customElements: { get() {}, define() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { platform: "Linux", userAgent: "production-module-test" },
  location: { origin: "https://blog.example.test", pathname: "/admin", search: "" },
  addEventListener() {},
  removeEventListener() {},
});
vm.runInContext("window = globalThis; self = globalThis", context);
const modules = new Map();
const getModule = async (file) => {
  if (!file.startsWith(`${assets}${path.sep}`)) throw new Error("Invalid module path.");
  if (modules.has(file)) return modules.get(file);
  const module = new vm.SourceTextModule(await readFile(file, "utf8"), {
    context,
    identifier: file,
  });
  modules.set(file, module);
  return module;
};
const evaluate = async (file) => {
  const module = await getModule(path.join(assets, file));
  if (module.status === "unlinked") {
    await module.link((specifier, importer) =>
      getModule(path.resolve(path.dirname(importer.identifier), specifier)),
    );
  }
  await module.evaluate();
};
await evaluate(entry);
await evaluate(management[0]);
await evaluate(subscriptions[0]);
console.log(
  "Production admin, content management and subscriptions modules evaluated successfully.",
);
