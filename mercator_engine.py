import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
JUPITER_TOKENS_URL = "https://quote-api.jup.ag/v6/tokens"
BTC_PRICE_URL       = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"

def get_btc_price():
    try:
        data = requests.get(BTC_PRICE_URL).json()
        return data.get('bitcoin', {}).get('usd')
    except Exception:
        return None

def get_jupiter_microcaps():
    try:
        tokens = requests.get(JUPITER_TOKENS_URL).json()
        results = []
        for token in tokens:
            if token.get("extensions", {}).get("coingeckoId") and (
                (token.get("fdv") and token["fdv"] <= 25_000_000) or
                (token.get("liquidity") and token["liquidity"] <= 5_000_000)
            ):
                results.append({
                    "symbol": token["symbol"],
                    "name": token["name"],
                    "fdv": token.get("fdv"),
                    "liquidity": token.get("liquidity"),
                    "coingeckoId": token.get("extensions", {}).get("coingeckoId")
                })
        return results
    except Exception:
        return []

def scan():
    btc_price = get_btc_price()
    microcaps = get_jupiter_microcaps()
    rows = []
    for tok in microcaps:
        row = {**tok, "btc_price": btc_price}
        rows.append(row)
    df = pd.DataFrame(rows)
    df.to_csv("mercator_log.csv", index=False)
    return df

if __name__ == "__main__":
    result = scan()
    print(result)