
from garminconnect import Garmin
import inspect

print([m for m in dir(Garmin) if not m.startswith('_')])
