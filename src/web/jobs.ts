import { buildDailyAnalysis, buildMarketingPosts } from '../logic/analysis'
import { sendTelegram } from '../integrations/telegram'
import { sendDiscord } from '../integrations/discord'
import { sendMastodon } from '../integrations/mastodon'

export async function postNow() {
  const { text } = await buildDailyAnalysis()
  const mk = buildMarketingPosts()
  const payload = [text, '', mk.telegram].join('\n')
  const out = []
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
  const out = []
  out.push(await sendTelegram(msg))
  out.push(await sendDiscord(msg))
  out.push(await sendMastodon(msg))
  return out
}
