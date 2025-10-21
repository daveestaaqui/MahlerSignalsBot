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

