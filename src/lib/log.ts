type Meta = Record<string, unknown>;

export function log(level: string, message: string, meta: Meta = {}): void {
  const payload = { msg: message, ...meta, ts: Date.now() };

  try {
    const consoleRecord = console as unknown as Record<string, unknown>;
    const candidate = consoleRecord[level];
    if (typeof candidate === "function") {
      (candidate as (arg: unknown) => void)(payload);
      return;
    }
  } catch {
    // fall back to standard console logging below
  }

  try {
    console.log({ lvl: level, ...payload });
  } catch {
    // noop
  }
}
