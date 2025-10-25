import { loadAggregatedAssets } from '../../services/dataHub.js';
import { CRYPTO_UNIVERSE } from '../../config/universe.js';
import { SignalRecord, stockUniq } from '../../signals/rules.js';

const MIN_CRYPTO_SCORE = Number(process.env.CRYPTO_MIN_SCORE || 0.6);

export async function runCrypto(): Promise<SignalRecord[]> {
  const now = Math.floor(Date.now() / 1000);
  const universe = await loadAggregatedAssets();
  const allowed = new Set(CRYPTO_UNIVERSE.map(s => s.toUpperCase()));

  return universe
    .filter(asset => allowed.has(asset.symbol.toUpperCase()))
    .map(asset => {
      const score = compositeScore(asset);
      return {
        symbol: asset.symbol.toUpperCase(),
        asset_type: 'crypto' as const,
        score,
        reason: buildReason(asset, score),
        features: asset,
        tier_min: 'elite' as const,
        created_at: now,
        uniq_key: stockUniq(`${asset.chain}-${asset.symbol}`.toUpperCase(), now, 'elite'),
      };
    })
    .filter(signal => signal.score >= MIN_CRYPTO_SCORE);
}

function compositeScore(asset: any) {
  const liquidity = normalize(asset.liquidityUSD, 3_000_000);
  const volume = normalize(asset.volumeUSD24h, 1_500_000);
  const momentum = normalize(asset.momentumScore, 0.4);
  const whales = normalize(asset.whaleScore, 0.4);
  const sentiment = clamp(asset.sentimentScore, -1, 1);
  const catalysts = asset.catalysts?.length ? 0.1 : 0;
  return Number((0.25 * liquidity + 0.2 * volume + 0.2 * momentum + 0.25 * whales + 0.1 * sentiment + catalysts).toFixed(4));
}

function buildReason(asset: any, score: number) {
  const parts = [
    `Score ${score.toFixed(2)}`,
    `Liquidity $${format(asset.liquidityUSD)}`,
    `Volume $${format(asset.volumeUSD24h)}`,
    `Momentum ${(asset.momentumScore * 100).toFixed(1)}%`,
    `Whale ${(asset.whaleScore * 100).toFixed(1)}%`,
  ];
  if (asset.catalysts?.length) parts.push(`Catalyst: ${asset.catalysts[0]}`);
  return parts.join(' | ');
}

function normalize(value: number, scale: number) {
  if (!Number.isFinite(value) || !scale) return 0;
  return Math.tanh(value / scale);
}

function clamp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

function format(v: number) {
  return Math.round(v || 0).toLocaleString();
}
