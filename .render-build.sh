rm -rf ./tests src/tests
corepack enable && corepack prepare pnpm@9 --activate
pnpm install --no-frozen-lockfile
pnpm run build