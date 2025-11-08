export type LogContext = Record<string, unknown> | undefined;

type LogFn = (message: string, context?: LogContext) => void;

function format(message: string, context?: LogContext) {
  if (context && Object.keys(context).length > 0) {
    return [message, JSON.stringify(context)];
  }
  return [message];
}

const makeLogger = (writer: (...args: any[]) => void): LogFn => (message, context) => {
  writer(...format(message, context));
};

export const logger = {
  info: makeLogger(console.info),
  warn: makeLogger(console.warn),
  error: makeLogger(console.error)
};

export const { info: logInfo, warn: logWarn, error: logError } = logger;
