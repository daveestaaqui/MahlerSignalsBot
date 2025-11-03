rm -rf ./tests src/tests
corepack enable && corepack prepare pnpm@9 --activate
pnpm install --no-frozen-lockfile
pnpm rebuild better-sqlite3
pnpm run build