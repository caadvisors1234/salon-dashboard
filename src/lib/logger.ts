import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

function resolvePrettyTransport(): pino.TransportSingleOptions | undefined {
  if (isProduction) return undefined;
  try {
    require.resolve("pino-pretty");
    return { target: "pino-pretty", options: { colorize: true } };
  } catch {
    return undefined;
  }
}

const prettyTransport = resolvePrettyTransport();

const baseLogger = pino({
  level,
  ...(prettyTransport ? { transport: prettyTransport } : {}),
});

export function createLogger(name: string) {
  return baseLogger.child({ name });
}

export type Logger = pino.Logger;
