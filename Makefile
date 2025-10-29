.PHONY: smoke ping gh-secrets rotate stripe telegram discord x chatid tg tg-pro tg-elite tg-free diagnostics build once

test-env:
	@echo "Ensure .env.local is populated before running helpers"

smoke: test-env
	./scripts/smoke.sh

ping: test-env
	./scripts/ping-admin.sh

gh-secrets: test-env
	./scripts/gh-set-secrets.sh

rotate:
	./scripts/rotate-admin-token.sh

stripe:
	./scripts/stripe-dev.sh

telegram: test-env
	./scripts/test-telegram.sh "Test message from AuroraSignals"

discord: test-env
	./scripts/test-discord.sh "Test message from AuroraSignals"

x: test-env
	./scripts/test-x.sh

chatid:
	./scripts/telegram-chatid.sh

tg:
	./scripts/send-telegram.sh "Test message from AuroraSignals"

telegram-setup:
	./scripts/telegram-setup.sh

tiers-telegram:
	./scripts/tiers-telegram-setup.sh

tg-pro:
	TELEGRAM_BOT_TOKEN=$${TELEGRAM_BOT_TOKEN:-$$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.local | tail -1 | cut -d= -f2-)} CHAT=$${TELEGRAM_CHAT_ID_PRO:-$$(grep -E '^TELEGRAM_CHAT_ID_PRO=' .env.local | tail -1 | cut -d= -f2-)} ./scripts/send-telegram.sh "PRO sanity ✅"

tg-elite:
	TELEGRAM_BOT_TOKEN=$${TELEGRAM_BOT_TOKEN:-$$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.local | tail -1 | cut -d= -f2-)} CHAT=$${TELEGRAM_CHAT_ID_ELITE:-$$(grep -E '^TELEGRAM_CHAT_ID_ELITE=' .env.local | tail -1 | cut -d= -f2-)} ./scripts/send-telegram.sh "ELITE sanity 👑"

tg-free:
	TELEGRAM_BOT_TOKEN=$${TELEGRAM_BOT_TOKEN:-$$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.local | tail -1 | cut -d= -f2-)} CHAT=$${TELEGRAM_CHAT_ID_FREE:-$$(grep -E '^TELEGRAM_CHAT_ID_FREE=' .env.local | tail -1 | cut -d= -f2-)} ./scripts/send-telegram.sh "FREE sanity (24h stocks)"

diagnostics:
	curl -fsS "$${BASE_URL:-https://aurora-signals.onrender.com}/diagnostics" | jq .

build:
	pnpm build

once:
	pnpm build
	pnpm once
