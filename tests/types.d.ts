declare module '../dist/web/server.js' {
  export const app: any;
  export function setRunDailyRunner(fn: (options?: { preview?: boolean }) => any): void;
  export function resetRunDailyRunner(): void;
  const defaultExport: any;
  export default defaultExport;
}
