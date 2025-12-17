from http.server import BaseHTTPRequestHandler
import json
import datetime
import os
import sys

# Try to import garminconnect - handle if missing (though requirements.txt should install it)
try:
    from garminconnect import Garmin, GarminConnectAuthenticationError
except ImportError:
    Garmin = None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            email = data.get('email')
            password = data.get('password')

            if not email or not password:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Missing email or password"}).encode('utf-8'))
                return

            if not Garmin:
                raise Exception("garminconnect library not installed")

            # Session storage in /tmp (only writable directory in Vercel)
            # We use a hash or just email to name the session file
            session_file = os.path.join("/tmp", f"garmin_session_{email}.json")

            garmin = Garmin(email, password)
            
            # Authenticate
            try:
                garmin.login(session_file)
            except (FileNotFoundError, GarminConnectAuthenticationError, Exception):
                garmin.login()
                garmin.garth.dump(session_file)

            # --- FETCH DATA (Same logic as fetch_data.py) ---
            today = datetime.date.today()
            today_str = today.isoformat()
            yesterday = today - datetime.timedelta(days=1)
            yesterday_str = yesterday.isoformat()
            
            # 28 Days Range
            range_28d = [today - datetime.timedelta(days=i) for i in range(28)]
            
            # Profile & Devices
            profile = garmin.get_user_profile()
            devices = garmin.get_devices()
            settings = garmin.get_userprofile_settings()
            full_name = garmin.get_full_name()
            display_name = garmin.display_name
            
            # Activities
            activities = garmin.get_activities(0, 50)
            
            # History
            history_28d = []
            for d in range_28d: 
                d_str = d.isoformat()
                try:
                    day_stats = garmin.get_stats(d_str)
                    try:
                        day_hrv = garmin.get_hrv_data(d_str)
                    except:
                        day_hrv = None
                        
                    history_28d.append({
                        "date": d_str,
                        "stats": day_stats,
                        "hrv": day_hrv
                    })
                except Exception:
                    pass

            # High Res Current Day
            steps = garmin.get_steps_data(today_str)
            steps_yesterday = garmin.get_steps_data(yesterday_str)
            heart_rate = garmin.get_heart_rates(today_str)
            sleep = garmin.get_sleep_data(today_str)
            stress = garmin.get_stress_data(today_str)
            body_battery = garmin.get_body_battery(today_str)
            
            response_data = {
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
                "history": history_28d
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg and "Unauthorized" in error_msg:
                error_msg = "Email ou mot de passe incorrect."
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False, 
                "error": error_msg,
                "error_type": type(e).__name__
            }).encode('utf-8'))
