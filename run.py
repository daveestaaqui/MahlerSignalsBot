from apscheduler.schedulers.blocking import BlockingScheduler
from mercator_engine import scan

scheduler = BlockingScheduler()

@scheduler.scheduled_job('interval', minutes=15)
def scheduled_scan():
    print("🔁 Running scheduled scan...")
    scan()

if __name__ == "__main__":
    print("📡 MERCATOR started. Scanning every 15 minutes.")
    scheduled_scan()  # run once immediately
    scheduler.start()