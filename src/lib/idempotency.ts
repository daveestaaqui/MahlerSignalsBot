const store = new Map<string, number>();

function purgeExpired(now: number) {
  for (const [key, expiresAt] of store) {
    if (expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function seen(key: string, ttlMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  purgeExpired(now);
  const expiry = store.get(key);
  if (expiry !== undefined && expiry > now) {
    return true;
  }
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 15 * 60 * 1000;
  store.set(key, now + ttl);
  return false;
}
