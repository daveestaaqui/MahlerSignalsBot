export async function withRetry(fn, tries = 3, baseMs = 400) {
  let last = false;
  for (let i = 0; i < tries; i++) {
    try {
      const result = await fn();
      if (result !== false) return result;
    } catch (err) {
      console.error('[retry]', err?.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, baseMs * Math.pow(2, i)));
  }
  return last;
}
