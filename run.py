import os
from solana.publickey import PublicKey
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, CallbackContext
from datetime import time
import mercator_engine
import re

raw_token = os.getenv("TOKEN_ADDRESS")
TOKEN_ADDRESS = PublicKey(raw_token) if raw_token else None

raw_liquidity = os.getenv("LIQUIDITY_POOL_ADDRESS")
LIQUIDITY_POOL_ADDRESS = PublicKey(raw_liquidity) if raw_liquidity else None

raw_score = os.getenv("LIQUIDITY_SCORE") or "0.0"
try:
    LIQUIDITY_SCORE = float(raw_score)
except ValueError:
    LIQUIDITY_SCORE = 0.0

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = int(os.getenv("CHAT_ID")) if os.getenv("CHAT_ID") else None

def welcome(update, context: CallbackContext):
    context.bot.send_message(
        chat_id=update.effective_chat.id,
        text=(
            "Welcome to MahlerSignalsBot! Every weekday at 7:30 AM EST you'll "
            "get our top market pick, plus opportunistic alerts. *Not financial advice.*"
        ),
        parse_mode="Markdown"
    )

async def scan_and_alert(context: CallbackContext):
    await mercator_engine.scan_and_send(context.bot, CHAT_ID)

app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
jq = app.job_queue
# Run scan every 15 minutes
jq.run_repeating(scan_and_alert, interval=900, first=0)
# Daily top pick at 7:30 AM EST, weekdays only
jq.run_daily(scan_and_alert, time=time(7, 30), days=(0,1,2,3,4))

app.add_handler(CommandHandler("start", welcome))
app.add_handler(MessageHandler(filters.Regex(r'^\s*start\s*$', flags=re.IGNORECASE), welcome))

if __name__ == "__main__":
    app.run_polling()