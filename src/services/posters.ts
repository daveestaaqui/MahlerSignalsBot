export type ProviderError = { provider: 'telegram' | 'x' | 'discord', error: string }
export type BroadcastSummary = { posted: number, providerErrors: ProviderError[] }

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

export async function broadcast(payload: Payload): Promise<BroadcastSummary> {
  const providerErrors: ProviderError[] = []
  let posted = 0
  const tasks: Array<Promise<[string, boolean]>> = [
    postTelegram(payload).then(ok => ['telegram', ok] as [string, boolean]),
    postX(payload).then(ok => ['x', ok] as [string, boolean]),
    postDiscord(payload).then(ok => ['discord', ok] as [string, boolean]),
  ]
  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [provider, ok] = r.value
      if (ok) posted += 1
      else providerErrors.push({ provider: provider as any, error: 'not-configured-or-rejected' })
    } else {
      const msg = r.reason?.message || String(r.reason || 'unknown')
      providerErrors.push({ provider: 'telegram', error: msg })
    }
  }
  return { posted, providerErrors }
}
