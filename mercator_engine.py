import os
import requests
import pandas as pd
from dotenv import load_dotenv

from solana.rpc.api import Client as SolanaClient
from web3 import Web3

load_dotenv()

def fetch_x_sentiment(coingecko_id):
    return 0.0

def fetch_telegram_sentiment():
    return 0.0

def fetch_onchain_flow(token_address, chain="solana"):
    return 0.0

def compute_confluence(ta_score, social_score, flow_score, liquidity_score):
    return round(0.4 * ta_score + 0.3 * social_score + 0.2 * flow_score + 0.1 * liquidity_score, 1)