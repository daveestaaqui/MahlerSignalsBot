# Data Pipeline Overview

## Connectors
| Domain | Source | Purpose | Auth Env | TTL | Notes |
|--------|--------|---------|----------|-----|-------|
| Stocks | AlphaVantage | Daily OHLCV + adjusted close | `ALPHAVANTAGE_KEY` | 1d | Builds gap / moving-average metrics. |
| Stocks | Finnhub | Intraday quote + sentiment | `FINNHUB_KEY` | 5m | Optional; falls back to samples if missing. |
| Stocks | Polygon.io | Aggregated candles | `POLYGON_KEY` | 15m | Confirms RVOL / price structure. |
| Stocks | Smart money + policy (stubs) | Insider, 13F, policy tailwinds | `FINTEL_API_KEY`, `WHALEWISDOM_COOKIE`, `GOVTRACK_API_KEY` | varies | Implement when keys are provisioned. |
| Crypto | CoinGecko | Spot prices & liquidity | (none) | 15m | Cached in `data_snapshots`. |
| Crypto | CryptoCompare | Market depth & mktcap metrics | `CRYPTOCOMPARE_API_KEY` | 30m | Optional paid plan. |
| Crypto | DexScreener | DEX liquidity + whale flow | (none) | 5m | Supplies DEX trading flow. |
| News | CryptoPanic / NewsAPI | Catalyst headlines | `CRYPTOPANIC_API_KEY`, `NEWSAPI_KEY` | 10m | Populates catalyst strings. |

Every connector writes to `data_snapshots` (SQLite). When a provider fails or a key is absent, synthetic samples keep the scoring engine producing output.

## Normalisation & Scoring
- Stocks: `src/pipeline/stocks/index.ts` converts OHLCV + smart money signals into `StockFeature` objects, then `src/signals/rules.ts` scores gap capitulation, mean reversion, policy tailwinds, sentiment.
- Crypto: `src/pipeline/crypto/index.ts` uses `src/services/dataHub.ts` (liquidity, volume, momentum, whale flow, sentiment) for elite-only signals.
- Tunables: `STOCK_MIN_SCORE`, `STOCK_ELITE_THRESHOLD`, `PRO_SCORE_THRESHOLD`, `ELITE_SCORE_THRESHOLD`, `CRYPTO_MIN_SCORE`.

## Persistence & Publish Flow
- `signals` table holds each scored event with tier floor, asset type, JSON feature payload, and optional `embargo_until` for Free-tier delays.
- `publish_queue` handles embargo: stock signals enqueue PRO and ELITE immediately, FREE at `created_at + TIERS.free.delaySeconds`; crypto enqueues ELITE only.
- Scheduler (`src/index.ts`) runs `runCycle` every 30 minutes to ingest + queue, and `flushPublishQueue` every 5 minutes to deliver to Telegram/Discord.

## Extending
1. Flesh out adapters in `src/pipeline/adapters/` once API keys are supplied (handle rate limits + caching).
2. Add/remove tickers in `src/config/universe.ts` or load from an external store.
3. Adjust reason formatting / feature output in `src/jobs/runCycle.ts` to match new analytics.
4. Extend `publish_queue` with additional channels (email, webhooks) by updating `queueStmt` and `flushPublishQueue`.
