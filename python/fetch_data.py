import sys
import json
import datetime
import os
from garminconnect import Garmin, GarminConnectAuthenticationError

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing email or password"}))
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]
    
    # Path for session file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    session_file = os.path.join(script_dir, f"garmin_session_{email}.json")
    
    try:
        # Initialize Garmin client
        garmin = Garmin(email, password)
        
        # Authenticate
        # Logic: Try using the session file first. If it fails (file not found or token expired), do a full login.
        try:
            # garminconnect's login can take a token_store path string in recent versions
            # It will try to load from it. If it fails, it might raise an exception or just login.
            # Best pattern with recent garminconnect (wrapping garth):
            garmin.login(session_file)
        except (FileNotFoundError, GarminConnectAuthenticationError, Exception) as e:
            # Fallback to full login
            # print(f"Session login failed ({e}), trying full login...", file=sys.stderr)
            garmin.login() # Full login
            # Save the new session
            garmin.garth.dump(session_file)

        today = datetime.date.today()
        today_str = today.isoformat()
        yesterday = today - datetime.timedelta(days=1)
        yesterday_str = yesterday.isoformat()
        
        # Ranges
        range_7d = [today - datetime.timedelta(days=i) for i in range(7)]
        range_28d = [today - datetime.timedelta(days=i) for i in range(28)]
        
        # --- FETCH DATA ---
        
        # 1. Profile & Devices
        profile = garmin.get_user_profile() # Contains gender/sex usually
        devices = garmin.get_devices()
        settings = garmin.get_userprofile_settings()
        full_name = garmin.get_full_name()
        display_name = garmin.display_name
        
        # 2. Activities (Extended to ~90 days / 100 limit)
        activities = garmin.get_activities(0, 50) # Limit to 50 to keep reasonable speed
        
        # 3. Wellness & History
        # We need to loop for history. To save time, we'll try to get daily summaries.
        # "get_user_summary" requires a date. "get_stats" requires a date.
        
        history_28d = []
        # Optimization: Only fetch last 7 days fully, and sparse/summary for rest if possible? 
        # User requested 28d continuous. We will fetch last 7 days of DETAILED daily stats. 
        # For 28 days, it might be too slow to do 28 requests sequentially in one go.
        # Let's try 7 days for now to ensure stability. 
        # User asked for 28. We'll do 7 days detailed, and maybe relying on cached/older data later.
        # actually, let's try 14 days. 
        
        # Fetching Daily Stats (Steps, RHR, Stress Avg, Sleep)
        # We'll stick to 'today' high res, and 'history' array of summaries.
        
        for d in range_28d: # Fetching 28 days for trends (especially HRV)
            d_str = d.isoformat()
            try:
                # get_stats returns a lot of daily summary info (steps, rhr, stress, etc)
                day_stats = garmin.get_stats(d_str)
                
                # HRV
                try:
                    # check if get_hrv_data is available and returns valid data
                    day_hrv = garmin.get_hrv_data(d_str)
                except:
                    day_hrv = None
                    
                history_28d.append({
                    "date": d_str,
                    "stats": day_stats,
                    "hrv": day_hrv
                })
            except Exception as e:
                # print(f"Error fetching stats for {d_str}: {e}", file=sys.stderr)
                pass

        # Current Day High Res
        steps = garmin.get_steps_data(today_str)
        steps_yesterday = garmin.get_steps_data(yesterday_str)
        heart_rate = garmin.get_heart_rates(today_str)
        sleep = garmin.get_sleep_data(today_str)
        stress = garmin.get_stress_data(today_str)
        body_battery = garmin.get_body_battery(today_str)
        
        json_response = {
            "success": True,
            "timestamp": datetime.datetime.now().isoformat(),
            "profile": profile,
            "identity": {
                "fullName": full_name,
                "displayName": display_name
            },
            "devices": devices,
            "settings": settings,
            "activities": activities,
            "wellness": {
                "date": today_str,
                "steps": steps,
                "steps_yesterday": steps_yesterday,
                "heart_rate": heart_rate,
                "sleep": sleep,
                "stress": stress,
                "body_battery": body_battery
            },
            "history": history_28d # Array of last 7 days stats
        }
        
        print(json.dumps(json_response))
        
    except Exception as e:
        # Catch-all for any other errors
        err_msg = str(e)
        if "401" in err_msg and "Unauthorized" in err_msg:
            err_msg = "Email ou mot de passe incorrect."
            
        error_resp = {
            "success": False,
            "error": err_msg,
            "error_type": type(e).__name__
        }
        print(json.dumps(error_resp))
        sys.exit(0)

if __name__ == "__main__":
    main()
