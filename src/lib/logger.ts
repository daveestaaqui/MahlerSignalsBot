import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

type LogLevel = "info" | "warn" | "error";
type Meta = Record<string, unknown>;

export interface RequestWithId extends Request {
  requestId?: string;
}

function writeLog(level: LogLevel, message: string, meta: Meta = {}): void {
  const payload = { level, message, ...meta, ts: Date.now() };
  try {
    const method = (console as unknown as Record<string, unknown>)[level];
    if (typeof method === "function") {
      (method as (arg: unknown) => void)(payload);
      return;
    }
  } catch {
    // ignore and fallback below
  }

  try {
    console.log(payload);
  } catch {
    // noop
  }
}

export function logInfo(message: string, meta?: Meta): void {
  writeLog("info", message, meta);
}

export function logWarn(message: string, meta?: Meta): void {
  writeLog("warn", message, meta);
}

export function logError(message: string, meta?: Meta): void {
  writeLog("error", message, meta);
}

export function attachRequestId(
  req: RequestWithId,
  _res: Response,
  next: NextFunction
): void {
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  next();
}
