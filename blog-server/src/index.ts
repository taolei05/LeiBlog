import { createApp } from "./app";
import { appConfig } from "./shared/config";
import { closeDb } from "./shared/db";
import { logStartupConnectionStatus } from "./shared/diagnostics/startup-checks";
import { closeRedis } from "./shared/redis";

const app = await createApp();

await logStartupConnectionStatus();

app.listen({
  hostname: appConfig.host,
  port: appConfig.port,
});

console.log(`LeiBlog API 已启动：http://${appConfig.host}:${appConfig.port}`);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，正在关闭 LeiBlog API`);

  const results = await Promise.allSettled([
    app.stop(),
    closeDb(),
    closeRedis(),
  ]);
  const failed = results.some((result) => result.status === "rejected");
  if (failed) {
    console.error("LeiBlog API 关闭时发生错误", results);
  }

  process.exitCode = failed ? 1 : 0;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
