from apscheduler.schedulers.blocking import BlockingScheduler
from mercator_engine import scan
import time

print("🟢 MERCATOR container booted.")

scheduler = BlockingScheduler()

@scheduler.scheduled_job('interval', minutes=15)
def scheduled_scan():
    print("🔁 Scheduled scan started.")
    try:
        scan()
    except Exception as e:
        print(f"❌ Scan error: {e}")

if __name__ == "__main__":
    print("📡 MERCATOR started. Scanning every 15 minutes.")
    scheduled_scan()  # run once immediately
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("🛑 MERCATOR stopped.")