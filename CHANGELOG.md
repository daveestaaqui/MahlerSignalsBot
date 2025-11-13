# Changelog

## v1.1.0
- Rebrand public copy to ManySignals (powered by Aurora-Signals) and refresh the marketing bundle with new hero/about/pricing sections.
- Add `/about` JSON endpoint plus front-end hydration, reuse the centralized legal disclaimer, and wire tier copy (Free / $14 / $39).
- Tighten CORS to allow GET access for status/health/metrics/signals/blog/legal/about from `manysignals.finance`.
- Polish `/signals/today` schema (scenario wording, macro rationale, illustrative stops, stable IDs, canonical disclaimers) and update consumers (frontend + marketing).

## v0.1.0
- First public MVP: monthly pricing only ($0 / $14 / $39)
- Static web UI + JSON APIs (FREE delayed 24h), /status dashboard
- Admin trigger (/admin/post), CLI tools (post-now, set-tier)
- Telegram bot (/pricing, /pro, /elite, /signals gated, /settier admin)
- SQLite persistence, pruning job, demo seeding, env validation
- Ops assets: PM2, systemd unit, Dockerfile

### Commit Summary
- ac834f4 ops: env check, prune job, seeding, PM2/systemd/Docker assets; finalize $0/$14/$39 MVP
- 4459da2 fix(web): server rebuilt; static UI + APIs + admin; monthly $0/$14/$39
- 1e6e0a1 feat(web): static pricing UI, gated JSON APIs, /status; FREE delayed 24h; monthly bash/4/9
- f3fa2e5 feat(bot+ops): gated Telegram signals, CLI tools, fallback checkout; $0/$14/$39
- d933e72 fix: env-driven checkout URLs without sed; add admin client, bot, health; bash/4/9
- 7540fd7 feat(admin): /admin/post trigger, HOST/PORT env, health script for $0/$14/$39
- bb93ed9 chore: offline dist build to bypass npm; boot & health-check for $0/$14/$39
- a7411f6 build: install deps, compile, test, and boot HTTP for $0/$14/$39 MVP
- 684547a feat: monthly signup MVP with gating, scheduler, Telegram posting, and promo stubs for X
- 0d0ff87 chore(pricing): unify docs, bot copy, and payment map for $0/$14/$39 only
- 6e97a21 chore(pricing): enforce 3-price model ($0/$14/$39); remove annuals & credits
- c2a6c05 chore: add CodeRabbit report
- c028ff8 chore(pricing): switch to 3-tier $14/$39 model
- 74e623d chore(pricing): switch to 3-tier $14/$39 model
- a85169f chore: init repo for CodeRabbit
