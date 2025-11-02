
import { buildDailyAnalysis, buildMarketingPosts } from '../logic/analysis.js'
import { sendTelegram } from '../integrations/telegram.js'
import { sendDiscord } from '../integrations/discord.js'
import { sendMastodon } from '../integrations/mastodon.js'

export async function postNow() {
  const { text } = await buildDailyAnalysis()
  const mk = buildMarketingPosts()
  const payload = [text, '', mk.telegram].join('\n')
  const out:any[] = []
  out.push(await sendTelegram(payload))
  out.push(await sendDiscord(payload))
  out.push(await sendMastodon(payload))
  return out
}

export async function postDaily(dryRun:boolean=false) {
  const { text } = await buildDailyAnalysis()
  const mk = buildMarketingPosts()
  const msg = [text, '', mk.discord].join('\n')
  if (dryRun) return [{ ok:true, dryRun:true }]
  const out:any[] = []
  out.push(await sendTelegram(msg))
  out.push(await sendDiscord(msg))
  out.push(await sendMastodon(msg))
  return out
}

export async function marketingBlast(topic?: string) {
  const { text } = await buildDailyAnalysis()
  const mk = buildMarketingPosts()
  const header = topic && topic.trim() ? `${topic.trim()}\n` : ''
  const payload = [header + text, '', mk.telegram].join('\n')
  const out:any[] = []
  out.push(await sendTelegram(payload))
  out.push(await sendDiscord(payload))
  out.push(await sendMastodon(payload))
  return out
}
