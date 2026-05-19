import { createApp } from "./app";
import { appConfig } from "./shared/config";
import { logStartupConnectionStatus } from "./shared/diagnostics/startup-checks";

const app = await createApp();

await logStartupConnectionStatus();

app.listen({
  hostname: appConfig.host,
  port: appConfig.port,
});

console.log(`LeiBlog API 已启动：http://${appConfig.host}:${appConfig.port}`);
