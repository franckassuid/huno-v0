
from garminconnect import Garmin
import inspect

print([m for m in dir(Garmin) if 'user' in m or 'settings' in m])
