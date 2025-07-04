from telegram import Update
from telegram.ext import ContextTypes
import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from telegram import Bot
from solana.rpc.api import Client as SolanaClient
from web3 import Web3
import asyncio
from solders.pubkey import Pubkey

# Load environment variables
load_dotenv()
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")
TELEGRAM_BOT_TOKEN    = os.getenv("TELEGRAM_BOT_TOKEN", "")
SOLANA_RPC_URL        = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
ETH_RPC_URL           = os.getenv("ETH_RPC_URL", "")
COINGECKO_ID          = os.getenv("COINGECKO_ID", "")
TOKEN_ADDRESS         = os.getenv("TOKEN_ADDRESS", "")

# Convert raw token address string into Pubkey object for Solana calls
if TOKEN_ADDRESS:
    try:
        TOKEN_ADDRESS = Pubkey.from_string(TOKEN_ADDRESS)
    except Exception:
        TOKEN_ADDRESS = None

# Parse liquidity score, treat empty or invalid as 0.0
_liq = os.getenv("LIQUIDITY_SCORE", None)
if not _liq:
    LIQUIDITY_SCORE = 0.0
else:
    try:
        LIQUIDITY_SCORE = float(_liq)
    except ValueError:
        LIQUIDITY_SCORE = 0.0

# Initialize clients
analyzer      = SentimentIntensityAnalyzer()
telegram_bot  = Bot(token=TELEGRAM_BOT_TOKEN)
solana_client = SolanaClient(SOLANA_RPC_URL)
w3            = Web3(Web3.HTTPProvider(ETH_RPC_URL)) if ETH_RPC_URL else None

def fetch_x_sentiment(coingecko_id):
    if not TWITTER_BEARER_TOKEN or not coingecko_id:
        return 0.0
    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"}
    params = {"query": coingecko_id, "max_results": 100, "tweet.fields": "text,lang"}
    resp = requests.get(url, headers=headers, params=params)
    data = resp.json().get("data", [])
    texts = [t["text"] for t in data if t.get("lang") == "en"]
    if not texts:
        return 0.0
    scores = [analyzer.polarity_scores(text)["compound"] for text in texts]
    return round(sum(scores) / len(scores), 2)

def fetch_telegram_sentiment():
    if not TELEGRAM_BOT_TOKEN:
        return 0.0
    try:
        updates = asyncio.run(telegram_bot.get_updates(limit=100))
    except Exception:
        return 0.0
    texts = [u.message.text for u in updates if u.message and u.message.text]
    if not texts:
        return 0.0
    scores = [analyzer.polarity_scores(text)["compound"] for text in texts]
    return round(sum(scores) / len(scores), 2)

def fetch_onchain_flow(token_address, chain="solana"):
    since = datetime.utcnow() - timedelta(hours=24)
    if chain.lower() == "solana":
        if not token_address:
            return 0
        sigs = solana_client.get_signatures_for_address(token_address, limit=500)
        return len(sigs.get("result", []))
    elif chain.lower() in ("ethereum", "eth") and w3:
        abi = [{
            "anonymous": False,
            "inputs": [
                {"indexed": True, "name": "from", "type": "address"},
                {"indexed": True, "name": "to",   "type": "address"},
                {"indexed": False, "name": "value","type": "uint256"}
            ],
            "name": "Transfer",
            "type": "event"
        }]
        contract = w3.eth.contract(address=Web3.to_checksum_address(token_address), abi=abi)
        latest   = w3.eth.block_number
        from_blk = max(0, latest - 6500)
        events   = contract.events.Transfer.get_logs(fromBlock=from_blk, toBlock=latest)
        total    = sum(evt["args"]["value"] for evt in events)
        try:
            decimals = contract.functions.decimals().call()
        except:
            decimals = 18
        return round(total / (10 ** decimals), 2)
    else:
        return 0.0

def compute_confluence(ta_score, social_score, flow_score, liquidity_score):
    return round(
        0.4 * ta_score +
        0.3 * social_score +
        0.2 * flow_score +
        0.1 * liquidity_score,
        1
    )

def scan():
    ta_score        = fetch_x_sentiment(COINGECKO_ID)
    social_score    = fetch_telegram_sentiment()
    flow_score      = fetch_onchain_flow(TOKEN_ADDRESS)
    confluence_score = compute_confluence(
        ta_score, social_score, flow_score, LIQUIDITY_SCORE
    )
    from alert_bot import send_alert
    message = (
        f"Signal: {confluence_score} "
        f"(TA {ta_score}, Soc {social_score}, Flow {flow_score}, Liq {LIQUIDITY_SCORE})"
    )
    send_alert(message)
    return confluence_score

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    welcome_text = (
        "👋 Welcome to MahlerSignalsBot!\n\n"
        "I deliver data-driven crypto insights for Solana & Ethereum right here in Telegram.\n"
        "Each weekday at 7:30 AM EST you'll get our top market pick, plus alerts when our criteria are met.\n"
        "*Not financial advice.*"
    )
    await context.bot.send_message(chat_id=update.effective_chat.id, text=welcome_text)
