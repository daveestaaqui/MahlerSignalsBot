declare var process: {
  env: Record<string, string | undefined>;
};

declare global {}
declare module 'node-cron';
declare module 'better-sqlite3';
declare module 'node-telegram-bot-api';
