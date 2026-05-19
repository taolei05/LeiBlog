import { appConfig } from "../config";
import { pingDb } from "../db";
import { pingRedis } from "../redis";

type StartupCheckResult = {
  durationMs: number;
  errorMessage: string | null;
  isConnected: boolean;
  name: string;
  target: string;
};

type StartupCheckInput = {
  check: () => Promise<boolean>;
  name: string;
  target: string;
};

function redactConnectionUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = "*****";
    }

    return url.toString();
  } catch {
    return "已配置的连接地址";
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function runStartupCheck(input: StartupCheckInput): Promise<StartupCheckResult> {
  const startedAt = performance.now();

  try {
    const isConnected = await input.check();

    return {
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: isConnected ? null : "连接检测返回失败",
      isConnected,
      name: input.name,
      target: input.target,
    };
  } catch (error) {
    return {
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: toErrorMessage(error),
      isConnected: false,
      name: input.name,
      target: input.target,
    };
  }
}

export function formatStartupCheckLine(result: StartupCheckResult) {
  const status = result.isConnected ? "正常" : "失败";
  const base = `[${status}] ${result.name}: ${result.target} (${result.durationMs}ms)`;

  return result.errorMessage ? `${base} - ${result.errorMessage}` : base;
}

export async function logStartupConnectionStatus() {
  console.log("LeiBlog 启动连接检测：");

  const results = await Promise.all([
    runStartupCheck({
      check: pingDb,
      name: "PostgreSQL 数据库",
      target: redactConnectionUrl(appConfig.databaseUrl),
    }),
    runStartupCheck({
      check: pingRedis,
      name: "Redis 缓存",
      target: redactConnectionUrl(appConfig.redisUrl),
    }),
  ]);

  for (const result of results) {
    const line = formatStartupCheckLine(result);
    if (result.isConnected) {
      console.log(line);
    } else {
      console.warn(line);
    }
  }

  return results;
}
