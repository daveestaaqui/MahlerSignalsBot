import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
JUPITER_TOKENS_URL = "https://quote-api.jup.ag/v6/tokens"
BTC_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"

def get_btc_price():
    try:
        r = requests.get(BTC_PRICE_URL).json()
        return r['bitcoin']['usd']
    except Exception as e:
        return None

def get_jupiter_microcaps():
    try:
        r = requests.get(JUPITER_TOKENS_URL).json()
        results = []
        for token in r:
            if token.get("extensions", {}).get("coingeckoId") and (
                (token.get("fdv") and token["fdv"] <= 25_000_000) or 
                (token.get("liquidity") and token["liquidity"] <= 5_000_000)
            ):
                results.append({
                    "symbol": token["symbol"],
                    "address": token["address"],
                    "fdv": token.get("fdv"),
                    "liquidity": token.get("liquidity"),
                    "name": token["name"],
                })
        return results
    except Exception as e:
        return []

def scan():
    btc = get_btc_price()
    tokens = get_jupiter_microcaps()
    log_data = []

    for token in tokens:
        log_data.append({
            "name": token["name"],
            "symbol": token["symbol"],
            "fdv": token["fdv"],
            "liquidity": token["liquidity"],
            "btc_price": btc
        })

    df = pd.DataFrame(log_data)
    df.to_csv("mercator_log.csv", index=False)
    return df

if __name__ == "__main__":
    data = scan()
    print(data)