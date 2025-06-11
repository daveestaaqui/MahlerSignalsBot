import os
import requests
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_alert(message: str):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = {"chat_id": CHAT_ID, "text": message}
    try:
        response = requests.post(url, data=data)
        return response.ok
    except Exception as e:
        return False

# Test alert
if __name__ == "__main__":
    test_msg = "📡 MERCATOR TEST\nThis is a test alert from MahlerSignalsBot."
    sent = send_alert(test_msg)
    print("Alert sent:", sent)