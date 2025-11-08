import type { Request, Response, NextFunction } from "express";

export type LogMeta = Record<string, unknown>;

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta: LogMeta = {}): void {
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    JSON.stringify({ level, message, ...meta })
  );
}

export const logInfo = (message: string, meta?: LogMeta): void => write("info", message, meta);
export const logWarn = (message: string, meta?: LogMeta): void => write("warn", message, meta);
export const logError = (message: string, meta?: LogMeta): void => write("error", message, meta);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  const requestId = Math.random().toString(36).slice(2, 10);
  Reflect.set(req, "requestId", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logInfo("request.complete", {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}
