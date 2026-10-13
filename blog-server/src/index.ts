import { createApp, closeAppRuntime, prepareAppRuntime } from "./app";
import { env } from "./shared/env";
import { MAX_BACKUP_REQUEST_BYTES } from "./shared/request-body";
import { startEmailNotificationWorker } from "./shared/email-notifications";

await prepareAppRuntime();

const app = createApp().listen({
  hostname: env.hostname,
  port: env.port,
  maxRequestBodySize: MAX_BACKUP_REQUEST_BYTES,
});

console.log(`LeiBlog server is running at ${app.server?.hostname}:${app.server?.port}`);
const notificationWorker = startEmailNotificationWorker();

let isShuttingDown = false;

const shutdown = async (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down LeiBlog server`);

  const results = await Promise.allSettled([app.stop(), notificationWorker.stop()]);
  results.push(...(await Promise.allSettled([closeAppRuntime()])));
  const hasFailure = results.some((result) => result.status === "rejected");
  if (hasFailure) {
    console.error("LeiBlog server failed to shut down cleanly", results);
  }

  process.exit(hasFailure ? 1 : 0);
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
