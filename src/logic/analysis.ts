
export async function buildDailyAnalysis() {
  const lines = [
    'AuroraSignals — Daily Pulse',
    'BTC/ETH/SOL overview',
    'Quality over noise.'
  ]
  const text = lines.join('\n')
  const short = 'AuroraSignals — quality over noise.'
  return { text, short }
}
export function buildMarketingPosts() {
  const t = 'Signals that actually ship alpha. #crypto #trading #Bitcoin #Ethereum #Solana'
  return { telegram: t, discord: t, mastodon: t }
}
