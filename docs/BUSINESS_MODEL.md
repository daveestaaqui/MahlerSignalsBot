# AuroraSignalX – Stocks-First Monetisation

## Tier Structure
- **FREE (Stocks only, 24h embargo)**
  - Telegram Free channel receives delayed stock recap (max 3 per drop).
  - Discord #free-feed mirrors same copy.
  - X account posts teaser thread referencing Free channel.
  - Objective: drive upgrades with CTA + performance highlights.
- **PRO — $14/mo (Stocks + advanced metrics)**
  - Real-time stock signals (20/day cap) with detailed features: moving averages, RVOL, sentiment, smart-money score, policy tailwind.
  - Morning playbook + end-of-day recap automatically generated from stored signals.
  - Optional PDF/email summary (future sprint).
- **ELITE — $39/mo (All stocks + crypto)**
  - Everything in PRO plus crypto (ETH/SOL majors + alt rotation) with on-chain / DEX metrics.
  - Zero embargo, priority alerts, webhook/API export hooks.
  - Exclusive macro notes + quarterly live briefing.

## Automation Flow
1. **Ingestion**
   - Stocks: `src/pipeline/stocks` consumes AlphaVantage/Finnhub/Polygon (fallback to synthetic data). Smart-money + policy stubs prepared for Fintel/Govtrack keys.
   - Crypto: `src/pipeline/crypto` aggregates CoinGecko/CryptoCompare/DexScreener via `dataHub`.
   - News: CryptoPanic / NewsAPI for catalysts; future SEC schedule integration.
2. **Scoring**
   - Stocks scored via `src/signals/rules.ts` (gap capitulation + RVOL + sentiment).
   - Crypto scored via composite of liquidity/volume/momentum/whales/sentiment.
   - Thresholds tuned via env vars.
3. **Storage & Embargo**
   - `signals` table stores feature JSON; `publish_queue` schedules per-tier messages.
   - Free tier entries auto-delay 24h; PRO/ELITE immediate, crypto exclusive to ELITE.
4. **Publishing**
   - Scheduler (`runCycle`) enqueues messages; `flushPublishQueue` broadcasts to Telegram/Discord.
   - X teaser posted per cycle; optional marketing automations can plug into queue.
5. **Monetisation**
   - Stripe monthly prices stored in env; webhook (future sprint) promotes/demotes Telegram membership.
   - CTA appended to Free posts emphasising upgrade value.

## Value Pillars
- **Reliability**: Redundant data adapters + cached snapshots, queue ensures embargo compliance.
- **Differentiation**: PRO focuses on equities with metrics traders expect; ELITE adds crypto alpha & on-chain context.
- **Scalability**: Config-driven ticker universes, env-based connector keys, SQLite queue manageable under cron.
- **Compliance**: Disclaimers appended, no untracked secrets in repo, 24h delay for Free to avoid real-time leakage.

## Next Steps (Business)
- Connect subscription events → Telegram role automation.
- Integrate live stock connectors once API keys provided.
- Launch referral program (unique invite codes per user record).
- Add weekly email digest for PRO using stored signals.
