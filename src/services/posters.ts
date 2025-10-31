export type Tier = 'PRO' | 'ELITE' | 'FREE'
export type Provider = 'telegram' | 'x' | 'discord'
export type ProviderError = { provider: Provider, error: string }
export type BroadcastSummary = { posted: number, providerErrors: ProviderError[], errors?: ProviderError[] }

type Payload = { text: string; html?: string }

async function postTelegram(_p: Payload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chats = [process.env.TELEGRAM_CHAT_ID_PRO, process.env.TELEGRAM_CHAT_ID_ELITE, process.env.TELEGRAM_CHAT_ID_FREE].filter(Boolean) as string[]
  if (!token || chats.length === 0) return false
  return true
}

async function postX(_p: Payload): Promise<boolean> {
  const key = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN
  if (!key) return false
  return true
}

async function postDiscord(_p: Payload): Promise<boolean> {
  const hooks = [process.env.DISCORD_WEBHOOK_URL_PRO, process.env.DISCORD_WEBHOOK_URL_ELITE, process.env.DISCORD_WEBHOOK_URL_FREE].filter(Boolean) as string[]
  if (hooks.length === 0) return false
  return true
}

function normalizePayload(a: unknown, b?: unknown): Payload {
  if (typeof a === 'string' && typeof b === 'string') return { text: b }
  if (typeof a === 'string' && b && typeof b === 'object') return b as Payload
  if (typeof a === 'string' && b === undefined) return { text: a }
  return a as Payload
}

export function toTier(t: string): Tier {
  const up = (t || '').toUpperCase()
  if (up === 'PRO' || up === 'ELITE' || up === 'FREE') return up
  return 'FREE'
}

export async function broadcast(payload: Payload): Promise<BroadcastSummary>
export async function broadcast(tier: Tier | string, payload: Payload | string): Promise<BroadcastSummary>
export async function broadcast(a: unknown, b?: unknown): Promise<BroadcastSummary> {
  const _ = normalizePayload(a, b)
  const providerErrors: ProviderError[] = []
  let posted = 0
  const tasks: Array<Promise<[Provider, boolean]>> = [
    postTelegram(_).then(ok => ['telegram', ok] as [Provider, boolean]),
    postX(_).then(ok => ['x', ok] as [Provider, boolean]),
    postDiscord(_).then(ok => ['discord', ok] as [Provider, boolean]),
  ]
  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [provider, ok] = r.value
      if (ok) posted += 1
      else providerErrors.push({ provider, error: 'not-configured-or-rejected' })
    } else {
      const msg = r.reason?.message || String(r.reason || 'unknown')
      providerErrors.push({ provider: 'telegram', error: msg })
    }
  }
  return { posted, providerErrors, errors: providerErrors }
}
