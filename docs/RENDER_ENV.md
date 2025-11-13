# Render Environment Reference

| Variable | Required | Description |
| --- | --- | --- |
| `BASE_URL` | ✅ | Canonical API base, defaults to `https://aurora-signals.onrender.com`. |
| `AURORA_BASE_URL` | ➖ | Optional marketing/config override exposed via `/config`. |
| `AURORA_VERSION` | ➖ | Injected build/diagnostics version string. |
| `HOST` | ✅ | Interface for Express (Render uses `0.0.0.0`). |
| `PORT` | ✅ | Listening port (`8787` on Render). |
| `SCHEDULE_MS` | ➖ | Optional polling interval for background schedulers. |
| `ADMIN_TOKEN` | ✅ | Bearer credential required for all `/admin/*` routes. |
| `HEALTH_PING_URL` | ➖ | URL hit by the scheduled health check pinger. |
| `EQUITY_API_KEY` | ✅ | Polygon key for equities data. |
| `EQUITY_API_BASE_URL` | ➖ | Override Polygon base URL. |
| `EQUITY_WATCHLIST` | ➖ | Comma-separated symbols overriding the default equities list. |
| `CRYPTO_API_KEY` | ➖ | Optional CoinGecko Pro key. |
| `CRYPTO_API_BASE_URL` | ➖ | Override CoinGecko base URL. |
| `CRYPTO_WATCHLIST` | ➖ | Override crypto asset IDs tracked by the engine. |
| `CRYPTOCOMPARE_API_KEY` | ➖ | Enables CryptoCompare connector inside `dataHub`. |
| `CRYPTOPANIC_API_KEY` | ➖ | Enables CryptoPanic sentiment connector. |
| `STRIPE_SECRET_KEY` | ✅ | Secret API key for Checkout sessions. |
| `STRIPE_PRICE_PRO` | ✅ | Stripe price ID for PRO subscriptions. |
| `STRIPE_PRICE_ELITE` | ✅ | Stripe price ID for ELITE subscriptions. |
| `STRIPE_SUCCESS_URL` | ✅ | Post-checkout redirect URL (Hostinger marketing success page). |
| `STRIPE_CANCEL_URL` | ✅ | Stripe cancel URL (Hostinger marketing cancel page). |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Secret for validating `/stripe/webhook`. |
| `POST_ENABLED` | ➖ | When `false`, disables automated posting. Defaults to `true`. |
| `DRY_RUN` | ➖ | Global dry-run flag for schedulers/posters. |
| `MARKETING_DRY_RUN` | ➖ | Forces `sendMarketingPosts` into preview-only mode. |
| `MAX_POSTS_PER_DAY` | ➖ | Overrides CADENCE maximum dispatches per day. |
| `ENABLE_STOCKS_DAILY` / `ENABLE_CRYPTO_DAILY` | ➖ | Toggle per-asset posting windows. |
| `WEEKLY_SUMMARY_DAY` | ➖ | Day-of-week (e.g., `SUN`) for weekly digest cron. |
| `TZ` | ➖ | Scheduler timezone (default `America/New_York`). |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token for Telegram broadcasts. |
| `TELEGRAM_CHAT_ID_FREE` | ✅ | Telegram chat for FREE tier. |
| `TELEGRAM_CHAT_ID_PRO` | ✅ | Telegram chat for PRO tier. |
| `TELEGRAM_CHAT_ID_ELITE` | ✅ | Telegram chat for ELITE tier. |
| `MARKETING_TELEGRAM_CHAT_ID` | ➖ | Dedicated marketing/Hostinger announcements channel (falls back to tier chats if unset). |
| `TELEGRAM_CHAT_ID` | ➖ | Generic chat ID consumed by helper scripts like `send-telegram.sh`. |
| `DISCORD_WEBHOOK_URL` | ✅ | Primary Discord webhook for automated posts. |
| `DISCORD_WEBHOOK_URL_FREE/PRO/ELITE` | ➖ | Tier-specific Discord webhooks used by ops scripts. |
| `MARKETING_DISCORD_WEBHOOK_URL` | ➖ | Marketing/Hostinger webhook (falls back to `DISCORD_WEBHOOK_URL`). |
| `PROMO_ENABLED` | ➖ | Enables promo fan-out (`promoteAll`). |
| `PROMO_X_ENABLED` | ➖ | Toggles X/Twitter posting inside promo fan-out. |
| `PROMO_DISCORD_ENABLED` | ➖ | Toggles Discord posting inside promo fan-out. |
| `X_BEARER_TOKEN` | ➖ | OAuth2 bearer token for X posting (used by promo + marketing jobs). |
| `X_ACCESS_TOKEN` / `X_ACCOUNT_ID` | ➖ | Legacy marketing workflow credentials for X. |
| `HEALTH_PING_URL` | ➖ | External endpoint hit by the scheduler health check. |
| `RENDER_DEPLOY_HOOK` | ➖ | Render deploy hook URL used by `scripts/redeploy.sh`. |
| `AURORA_VERSION` | ➖ | Build identifier surfaced via `/diagnostics`. |

Legend: ✅ required for production; ➖ optional but recommended when the associated channel is enabled.
