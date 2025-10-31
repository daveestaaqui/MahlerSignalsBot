/// <reference types="node" />
/// <reference types="node-cron" />
/// <reference types="better-sqlite3" />
/// <reference types="node-telegram-bot-api" />
/// <reference types="express" />

declare var process: {
  env: Record<string, string | undefined>;
};

declare global {}
declare module 'node-cron';
declare module 'better-sqlite3';
declare module 'node-telegram-bot-api';
