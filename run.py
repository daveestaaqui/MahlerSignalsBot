# run.py
import os
from mercator_engine import scan
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)

# pull these in from your env
TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

WELCOME = (
    "👋 Welcome to MahlerSignals!\n\n"
    "I’ll ping you every 5 minutes with the latest on-chain signals. "
    "Use /start to see this message again."
)

async def start_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Send a concise welcome when someone types /start."""
    await ctx.bot.send_message(
        chat_id=update.effective_chat.id,
        text=WELCOME
    )

async def periodic_scan(ctx: ContextTypes.DEFAULT_TYPE):
    """Run your scan() and push the result to your chat."""
    try:
        result = scan()
        text = f"✅ Scan result:\n{result}"
    except Exception as e:
        text = f"❌ Scan error:\n{e}"
    await ctx.bot.send_message(
        chat_id=CHAT_ID,
        text=text
    )

def main():
    # build the bot
    app = ApplicationBuilder().token(TOKEN).build()

    # /start handler
    app.add_handler(CommandHandler("start", start_cmd))

    # schedule the scan every 5 min, first run immediately
    jobq = app.job_queue
    jobq.run_repeating(periodic_scan, interval=300, first=0)

    # start long‐polling (this blocks)
    app.run_polling()

if __name__ == "__main__":
    main()