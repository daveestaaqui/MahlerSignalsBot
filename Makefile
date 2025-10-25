.PHONY: smoke ping gh-secrets rotate stripe telegram discord x
test-env:
	@echo "Ensure .env.local is populated before running helpers"
smoke: test-env ; ./scripts/smoke.sh
ping: test-env ; ./scripts/ping-admin.sh
gh-secrets: test-env ; ./scripts/gh-set-secrets.sh
rotate: ; ./scripts/rotate-admin-token.sh
stripe: ; ./scripts/stripe-dev.sh
telegram: test-env ; ./scripts/test-telegram.sh "Test message from AuroraSignals"
discord: test-env ; ./scripts/test-discord.sh "Test message from AuroraSignals"
x: test-env ; ./scripts/test-x.sh
chatid: ; ./scripts/telegram-chatid.sh

tg: ; ./scripts/send-telegram.sh "Test message from AuroraSignals"


telegram-setup: ; ./scripts/telegram-setup.sh

tiers-telegram: ; ./scripts/tiers-telegram-setup.sh
tg-pro: ; TELEGRAM_BOT_TOKEN=$$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.local | tail -1 | cut -d= -f2-) CHAT=$$(grep -E '^TELEGRAM_CHAT_ID_PRO=' .env.local | tail -1 | cut -d= -f2-) ./scripts/send-telegram.sh "PRO sanity ✅"
tg-elite: ; TELEGRAM_BOT_TOKEN=$$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.local | tail -1 | cut -d= -f2-) CHAT=$$(grep -E '^TELEGRAM_CHAT_ID_ELITE=' .env.local | tail -1 | cut -d= -f2-) ./scripts/send-telegram.sh "ELITE sanity 👑"
diagnostics: ; curl -fsS "$${BASE_URL:-https://aurora-signals.onrender.com}/diagnostics" | jq .
tg-free:  ; TELEGRAM_BOT_TOKEN=$$(grep -E ^TELEGRAM_BOT_TOKEN= .env.local | tail -1 | cut -d= -f2-) CHAT=$$(grep -E ^TELEGRAM_CHAT_ID_FREE=  .env.local | tail -1 | cut -d= -f2-) ./scripts/send-telegram.sh "FREE sanity (24h stocks)"
once: ; curl -fsS -X POST "$${BASE_URL:-https://aurora-signals.onrender.com}/admin/post" -H "Authorization: Bearer $${ADMIN_TOKEN:?}" -d '' && echo
