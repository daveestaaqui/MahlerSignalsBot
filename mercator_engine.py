#!/usr/bin/env python3
import traceback
import time
from mercator_engine import scan
from apscheduler.schedulers.blocking import BlockingScheduler

print("🟢 Starting run.py execution...")
try:
    scheduler = BlockingScheduler()

    @scheduler.scheduled_job('interval', minutes=15)
    def scheduled_scan():
        print("🔁 Scheduled scan started.")
        try:
            scan()
            print("✅ Scan completed")
        except Exception:
            print("❌ Scan error:")
            traceback.print_exc()

    print("📡 MERCATOR main block started.")
    scheduled_scan()
    print("✅ Manual scan executed")
    scheduler.start()
    print("✅ Scheduler started")
except Exception:
    print("❌ Uncaught error:")
    traceback.print_exc()
    while True:
        print("🌀 MERCATOR heartbeat after crash")
        time.sleep(15)