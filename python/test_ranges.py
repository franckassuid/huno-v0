
from garminconnect import Garmin
import datetime
import os
import json
import sys

# Load credentials from env or args (mocking for test script, user has them in fetch_data.py)
# We will just import the setup from fetch_data logic if possible, or just copy-paste the login part.

def test_fetch_ranges():
    # Placeholder for login - in real usage we get this from args
    email = sys.argv[1]
    password = sys.argv[2]
    
    try:
        garmin = Garmin(email, password)
        garmin.login()
        
        today = datetime.date.today()
        start_date_7d = today - datetime.timedelta(days=6) # inclusive
        start_date_28d = today - datetime.timedelta(days=27)
        
        print(f"Fetching ranges from {start_date_28d} to {today}")

        # 1. Activities (last 90 days)
        # get_activities(start, limit) -> we can use limit=100
        activities = garmin.get_activities(0, 100) # Latest 100 activities
        print(f"Fetched {len(activities)} activities")

        # 2. Daily Steps (Range?)
        # get_daily_steps(start, end)
        # steps_history = garmin.get_daily_steps(start_date_28d.isoformat(), today.isoformat())
        # print(f"Fetched steps history: {len(steps_history) if steps_history else 'None'}")
        
        # 3. Training/HRV
        # get_training_status()
        # hrv = garmin.get_hrv_data(today.isoformat()) 
        # print("Fetched today's HRV")

        # 4. Body Comp / Stats
        # stats = garmin.get_stats(today.isoformat())
        # print("Fetched today's stats")

        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 2:
        test_fetch_ranges()
    else:
        print("Usage: python3 test_ranges.py <email> <password>")
