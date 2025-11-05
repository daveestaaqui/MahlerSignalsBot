export const log = (
  level: string,
  message: string,
  meta: Record<string, unknown> = {}
) => {
  try {
    const payload = { msg: message, ...meta, ts: Date.now() };
    if (typeof (console as Record<string, any>)[level] === "function") {
      (console as Record<string, (arg: unknown) => void>)[level](payload);
    } else {
      console.log({ lvl: level, ...payload });
    }
  } catch {
    // noop
  }
};
