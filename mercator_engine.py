import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
JUPITER_TOKENS_URL = "https://quote-api.jup.ag/v6/tokens"
BTC_PRICE_URL       = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"

def get_btc_price():
    try:
        return requests.get(BTC_PRICE_URL).json()['bitcoin']['usd']
    except:
        return None

def get_jupiter_microcaps():
    try:
        data = requests.get(JUPITER_TOKENS_URL).json()
        results = []
        for t in data:
            if t.get("extensions", {}).get("coingeckoId") and (
                (t.get("fdv") and t["fdv"] <= 25_000_000) or
                (t.get("liquidity") and t["liquidity"] <= 5_000_000)
            ):
                results.append({
                    "symbol": t["symbol"],
                    "name":   t["name"],
                    "fdv":    t.get("fdv"),
                    "liquidity": t.get("liquidity")
                })
        return results
    except:
        return []

def scan():
    btc = get_btc_price()
    tokens = get_jupiter_microcaps()
    rows = []
    for tok in tokens:
        rows.append({**tok, "btc_price": btc})
    df = pd.DataFrame(rows)
    df.to_csv("mercator_log.csv", index=False)
    return df

if __name__ == "__main__":
    print(scan())