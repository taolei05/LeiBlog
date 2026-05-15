import { createApp } from "./app";
import { appConfig } from "./shared/config";

const app = await createApp();

app.listen({
  hostname: appConfig.host,
  port: appConfig.port,
});

console.log(`LeiBlog API running at http://${appConfig.host}:${appConfig.port}`);
