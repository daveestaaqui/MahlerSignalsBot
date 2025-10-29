const normalize = (value: string | undefined | null) =>
  typeof value === 'string' && value.trim().length ? value.trim() : '';

const resolvedFmp =
  normalize(process.env.FMP_KEY) ||
  normalize(process.env.FMP_API_KEY) ||
  '';

if (resolvedFmp) {
  if (!process.env.FMP_KEY) {
    process.env.FMP_KEY = resolvedFmp;
  }
  if (!process.env.FMP_API_KEY) {
    process.env.FMP_API_KEY = resolvedFmp;
  }
}

export const PROVIDER_KEYS = {
  FMP: resolvedFmp,
} as const;

export function hasProvider(key: keyof typeof PROVIDER_KEYS): boolean {
  const value = PROVIDER_KEYS[key];
  return typeof value === 'string' && value.length > 0;
}
