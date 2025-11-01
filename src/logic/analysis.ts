type Ticker = 'bitcoin'|'ethereum'|'solana'
type PriceMap = Record<Ticker,{usd:number,usd_24h_change:number}>
async function getPrices(ids: Ticker[]): Promise<PriceMap> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids='+ids.join(',')+'&vs_currencies=usd&include_24hr_change=true'
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error('coingecko ' + r.status)
  const j = await r.json()
  return {
    bitcoin: { usd: j.bitcoin?.usd ?? 0, usd_24h_change: j.bitcoin?.usd_24h_change ?? 0 },
    ethereum:{ usd: j.ethereum?.usd ?? 0, usd_24h_change: j.ethereum?.usd_24h_change ?? 0 },
    solana:  { usd: j.solana?.usd ?? 0, usd_24h_change: j.solana?.usd_24h_change ?? 0 },
  }
}
function pct(n:number){ return (n>=0?'+':'')+n.toFixed(2)+'%' }
export async function buildDailyAnalysis() {
  const p = await getPrices(['bitcoin','ethereum','solana'])
  const lines = [
    'AuroraSignals — Daily Pulse',
    `BTC: $${p.bitcoin.usd.toFixed(0)} (${pct(p.bitcoin.usd_24h_change)})`,
    `ETH: $${p.ethereum.usd.toFixed(0)} (${pct(p.ethereum.usd_24h_change)})`,
    `SOL: $${p.solana.usd.toFixed(2)} (${pct(p.solana.usd_24h_change)})`,
    'Take: Momentum favors leaders; watch pullbacks to supports.',
  ]
  const text = lines.join('\n')
  const short = `BTC ${pct(p.bitcoin.usd_24h_change)} · ETH ${pct(p.ethereum.usd_24h_change)} · SOL ${pct(p.solana.usd_24h_change)} — AuroraSignals`
  return { text, short }
}
export function buildMarketingPosts() {
  const captions = [
    'Signals that actually ship alpha. Join AuroraSignals.',
    'Quiet confidence. Clean entries. Fewer alerts, better ones.',
    'We post when it matters — not just because the chart moved.',
  ]
  const hashtags = '#crypto #trading #Solana #Ethereum #Bitcoin #alpha'
  return {
    telegram: `${captions[0]}\n${hashtags}`,
    discord:  `${captions[1]}  ${hashtags}`,
    mastodon: `${captions[2]}  ${hashtags}`
  }
}
