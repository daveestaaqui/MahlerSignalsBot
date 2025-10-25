import { AggregatedAsset, loadAggregatedAssets } from '../services/dataHub.js';

export type Signal = {
  id: string;
  ts: number;
  chain: AggregatedAsset['chain'];
  symbol: string;
  score: number;
  summary: string;
  tier: 'PRO'|'ELITE';
  catalysts: string[];
};

const ELITE_THRESHOLD = Number(process.env.ELITE_SCORE_THRESHOLD || 0.85);
const PRO_THRESHOLD   = Number(process.env.PRO_SCORE_THRESHOLD   || 0.55);

export async function fetchUniverse(): Promise<AggregatedAsset[]> {
  return loadAggregatedAssets();
}

export function score(asset: AggregatedAsset): number {
  const norm = (value: number, scale = 1) => Number.isFinite(value) ? Math.tanh(value / scale) : 0;
  const liquidity = norm(asset.liquidityUSD, 5_000_000);
  const volume    = norm(asset.volumeUSD24h, 2_000_000);
  const momentum  = norm(asset.momentumScore, 0.5);
  const whales    = norm(asset.whaleScore, 0.5);
  const sentiment = asset.sentimentScore;
  const composite = (0.25 * liquidity) +
                    (0.20 * volume) +
                    (0.20 * momentum) +
                    (0.20 * whales) +
                    (0.15 * sentiment);
  return Number(composite.toFixed(4));
}

function tierFor(scoreValue: number): 'PRO'|'ELITE' {
  if(scoreValue >= ELITE_THRESHOLD) return 'ELITE';
  if(scoreValue >= PRO_THRESHOLD) return 'PRO';
  return 'PRO';
}

function buildSummary(asset: AggregatedAsset, scoreValue: number): string {
  const catalyst = asset.catalysts?.[0] ? `Catalyst: ${asset.catalysts[0]}` : 'Catalyst: pending verification';
  return [
    `${asset.chain}:${asset.symbol}`,
    `Price: $${asset.priceUSD.toFixed(4)}`,
    `Vol 24h: $${Math.round(asset.volumeUSD24h).toLocaleString()}`,
    `Liquidity: $${Math.round(asset.liquidityUSD).toLocaleString()}`,
    `Momentum: ${(asset.momentumScore*100).toFixed(1)}%`,
    `Whale Score: ${(asset.whaleScore*100).toFixed(1)}%`,
    `Sentiment: ${(asset.sentimentScore*100).toFixed(1)}%`,
    `Score: ${scoreValue.toFixed(3)}`,
    catalyst,
  ].join(' • ');
}

export async function selectTop(nPro=20, nElite=10): Promise<{pro:Signal[], elite:Signal[]}> {
  const universe = await fetchUniverse();
  const ts = Date.now();
  const enriched = universe.map(asset => {
    const sc = score(asset);
    return {
      id:`${asset.chain}-${asset.symbol}-${ts}`,
      ts,
      chain: asset.chain,
      symbol: asset.symbol,
      score: sc,
      summary: buildSummary(asset, sc),
      tier: tierFor(sc),
      catalysts: asset.catalysts.slice(0,3),
    };
  }).sort((a,b)=> b.score - a.score);

  const elite = enriched.filter(item => item.tier === 'ELITE').slice(0, nElite);
  const proPool = enriched.filter(item => item.tier === 'PRO' && !elite.find(e=> e.symbol===item.symbol)).slice(0, nPro);
  return {
    pro: proPool,
    elite,
  };
}
