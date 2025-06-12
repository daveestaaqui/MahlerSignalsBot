from apscheduler.schedulers.blocking import BlockingScheduler
from mercator_engine import scan

scheduler = BlockingScheduler()

@scheduler.scheduled_job("interval", minutes=5)
def periodic_scan():
    try:
        result = scan()
        print(f"✅ Scan result: {result}")
    except Exception as e:
        # don't accidentally await a coroutine here
        print(f"❌ Scan error: {e}")

if __name__ == "__main__":
    # run once immediately, then every 5 min
    periodic_scan()
    scheduler.start()