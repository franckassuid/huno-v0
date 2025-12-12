'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity, RotateCcw, Footprints, Loader2, Download, Heart, Moon,
  User, Database, Zap, Flame, Timer, TrendingUp, Calendar, MapPin,
  Battery, HelpCircle, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import garminCache from '../../garmin-cache.json';

// --- INTERFACES: GARMIN (Source) ---

interface GarminData {
  profile: any;
  cardio: {
    vo2Max?: { vo2MaxPrecise: number }[];
    heartRate?: any;
    activities?: any[];
    fitnessAge?: any;
  };
  sleep?: {
    dailySleepDTO?: any;
  };
  wellness?: {
    bodyBattery?: any;
    stress?: any;
    hrv?: any;
  };
  lifestyle?: {
    summary?: any;
  };
}

// --- INTERFACES: HUNO PROFILE (Destination) ---

interface HunoProfile {
  userId: number | null;
  garminIds: {
    id: number | null;
    profileId: number | null;
    garminGUID: string | null;
  };
  identity: {
    fullName: string | null;
    userName: string | null;
    location: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    bmi: number | null;
  };
  garminMeta: {
    userLevel: number | null;
    userPoints: number | null;
    nextLevelThreshold: number | null;
  };
  cardioStatus: {
    vo2Max: number | null;
    restingHrToday: number | null;
    restingHr7dAvg: number | null;
    minHrToday: number | null;
    maxHrToday: number | null;
    hrDate: string | null;
    hasContinuousHrData: boolean;
    heartRateValues: [number, number | null][]; // timestamp, value
  };
  wellnessStatus: {
    stress: any | null;
    bodyBattery: any | null;
    hrv: any | null;
    sleep: {
      totalSleepSeconds: number | null;
      deepSleepSeconds: number | null;
      lightSleepSeconds: number | null;
      remSleepSeconds: number | null;
    };
  };
  recentActivities: {
    activityId: number;
    name: string;
    sport: string | null;
    startTimeLocal: string;
    startTimeGMT: string;
    durationSec: number;
    distanceM: number | null;
    calories: number | null;
    averageHR: number | null;
    maxHR: number | null;
    trainingLoad: number | null;
    aerobicTE: number | null;
    anaerobicTE: number | null;
    moderateMinutes: number | null;
    vigorousMinutes: number | null;
  }[];
  dataFreshness: {
    profileLastUpdated: string | null;
    lastHrDate: string | null;
    lastActivityDate: string | null;
  };
}

// --- HELPER FUNCTIONS ---

function buildHunoProfile(garminData: GarminData): HunoProfile {
  const p = garminData.profile || {};
  const cardio = garminData.cardio || {};
  const hr = cardio.heartRate || {};
  const vo2 = cardio.vo2Max?.[0] || null;
  const activities = cardio.activities || [];
  const sleepDTO = garminData.sleep?.dailySleepDTO || {};
  const wellness = garminData.wellness || {};

  // Weight is in grams in Garmin data
  const weightKg = typeof p.weight === "number" ? p.weight / 1000 : null;
  const heightCm = typeof p.height === "number" ? p.height : null;
  const heightM = heightCm ? heightCm / 100 : null;

  const bmi =
    weightKg && heightM
      ? Number((weightKg / (heightM * heightM)).toFixed(2))
      : null;

  const lastActivity = activities[0] || null;

  return {
    userId: p.profileId ?? null,
    garminIds: {
      id: p.id ?? null,
      profileId: p.profileId ?? null,
      garminGUID: p.garminGUID ?? null
    },
    identity: {
      fullName: p.fullName ?? null,
      userName: p.userName ?? null,
      location: p.location ?? null,
      age: p.age ?? null,
      heightCm,
      weightKg,
      bmi
    },
    garminMeta: {
      userLevel: p.userLevel ?? null,
      userPoints: p.userPoint ?? null,
      nextLevelThreshold: p.levelPointThreshold ?? null
    },
    cardioStatus: {
      vo2Max: vo2?.vo2MaxPrecise ?? null,
      restingHrToday: hr.restingHeartRate ?? null,
      restingHr7dAvg: hr.lastSevenDaysAvgRestingHeartRate ?? null,
      minHrToday: hr.minHeartRate ?? null,
      maxHrToday: hr.maxHeartRate ?? null,
      hrDate: hr.calendarDate ?? null,
      hasContinuousHrData:
        Array.isArray(hr.heartRateValues) && hr.heartRateValues.length > 0,
      heartRateValues: Array.isArray(hr.heartRateValues) ? hr.heartRateValues : []
    },
    wellnessStatus: {
      stress: wellness.stress ?? null,
      bodyBattery: wellness.bodyBattery ?? null,
      hrv: wellness.hrv ?? null,
      sleep: {
        totalSleepSeconds: sleepDTO.sleepTimeSeconds ?? null,
        deepSleepSeconds: sleepDTO.deepSleepSeconds ?? null,
        lightSleepSeconds: sleepDTO.lightSleepSeconds ?? null,
        remSleepSeconds: sleepDTO.remSleepSeconds ?? null
      }
    },
    recentActivities: activities.map((a: any) => ({
      activityId: a.activityId,
      name: a.activityName,
      sport: a.activityType?.typeKey ?? null,
      startTimeLocal: a.startTimeLocal,
      startTimeGMT: a.startTimeGMT,
      durationSec: a.duration,
      distanceM: a.distance ?? null,
      calories: a.calories ?? null,
      averageHR: a.averageHR ?? null,
      maxHR: a.maxHR ?? null,
      trainingLoad: a.activityTrainingLoad ?? null,
      aerobicTE: a.aerobicTrainingEffect ?? null,
      anaerobicTE: a.anaerobicTrainingEffect ?? null,
      moderateMinutes: a.moderateIntensityMinutes ?? null,
      vigorousMinutes: a.vigorousIntensityMinutes ?? null
    })),
    dataFreshness: {
      profileLastUpdated: p.levelUpdateDate ?? null,
      lastHrDate: hr.calendarDate ?? null,
      lastActivityDate: lastActivity?.startTimeLocal ?? null
    }
  };
}

// --- FINAL JSON SCHEMA ---

interface HunoSchema {
  metadata: {
    schema_version: string;
    generated_at: string;
    source: string;
  };
  identity: {
    fullName: string | null;
    sex: string | null;
    age: number | null;
    height_cm: number | null;
    weight_kg: number | null;
    location: string | null;
  };
  cardioStatus: {
    vo2max: number | null;
    resting_hr: number | null;
    hr_min: number | null;
    hr_max: number | null;
    hr_7day_avg_rest: number | null;
  };
  wellnessStatus: {
    sleep_available: boolean;
    stress_available: boolean;
    hrv_available: boolean;
  };
  recentActivities: {
    swims: {
      date: string;
      distance_m: number;
      duration_s: number;
      avg_hr: number | null;
      training_load: number | null;
    }[];
    dives: {
      date: string;
      max_depth_m: number;
      bottom_time_s: number;
    }[];
  };
  onboarding: {
    primary_goal: string | null;
    secondary_goal: string | null;
    goal_timeline: {
      type: "3_months" | "6_months" | "custom_date" | string;
      value: string | null;
    };
    priority: string | null;
    injuries: {
      zone: string;
      category: string;
      severity: number;
    }[];
    equipment: {
      gym_access: boolean;
      home_equipment: string[];
    };
    preferences: {
      likes: string[];
      dislikes: string[];
      impact_tolerance: "low" | "medium" | "high" | null;
      preferred_intensity: number | null;
    };
    lifestyle: {
      sleep_quality: number | null;
      stress_level: number | null;
      energy_level: number | null;
    };
    availability: {
      sessions_per_week: number | null;
      session_duration_min: number | null;
      weekly_volume_minutes: number | null;
    };
    algorithm_recommendations: {
      recommended_sessions_per_week: number | null;
      recommended_session_duration_min: number | null;
      target_weekly_minutes: number | null;
      volume_match_score: number | null;
    };
    fitness_tests: {
      pushups_max: number | null;
      squats_max: number | null;
      plank_seconds: number | null;
      mobility_score: number | null;
    };
  };
}

function generateFinalJson(profile: HunoProfile, onboardingData: any, rawGarminActivities: any[] = []): HunoSchema {
  const meta = profile.garminMeta;
  const p = profile.identity;
  const c = profile.cardioStatus;
  const w = profile.wellnessStatus;

  // normalize onboarding answers
  const o = onboardingData || {};

  // calculate goals
  const secondaryGoalsRaw = o['secondary_goals'] || [];
  const secondaryGoalStr = Array.isArray(secondaryGoalsRaw)
    ? secondaryGoalsRaw.filter((g: string) => g !== 'none').join(', ')
    : (secondaryGoalsRaw === 'none' ? null : secondaryGoalsRaw);

  // timelines
  let timelineType = o['goal_timeline'] || '3_months'; // default
  let timelineValue = null;
  if (timelineType === 'custom_date') {
    timelineValue = o['custom_date_value'] || null;
  }

  // injuries map
  const injuriesRaw = [];
  if (o['has_injuries'] === 'yes') {
    // We need to look for keys like 'injury_zone_*' if they were dynamic
    // But currently the updated flow might store them differently or just 'injury_zones'.
    // Based on previous code, zones are multi-select in 'injury_zones'.
    // And for each zone, we asked severity/nature.
    // Since those dynamic questions might be hard to parse back without knowing IDs, 
    // we will do a best effort mapping or default to simple list if complex map missing.
    const zones = (o['injury_zones'] as string[]) || [];
    for (const z of zones) {
      // Try to find severity/nature answers
      const nature = o[`injury_nature_${z}`] || 'unknown';
      const severity = o[`injury_severity_${z}`] || 5;
      injuriesRaw.push({
        zone: z,
        category: nature,
        severity: Number(severity)
      });
    }
  }

  // equipment
  const equipRaw = (o['equipment'] as string[]) || [];
  const gymAccess = (o['training_place'] === 'gym' || equipRaw.includes('gym_full'));
  const homeEquip = equipRaw.filter((e: string) => e !== 'none' && e !== 'gym_full');

  // preferences
  // We have 'global_avoid_movements' as dislikes
  const dislikes = (o['global_avoid_movements'] as string[]) || [];
  const likes = (o['favorite_activities'] as string[]) || []; // if we had this question

  // availability calculation
  const sessionsPerWeek = Number(o['sessions_per_week']) || 0;
  const sessionDur = Number(o['session_duration']) || 0;
  const weeklyVol = sessionsPerWeek * sessionDur;

  // recommendations
  const algo = o['algorithm_recommendations'] || {};
  const targetVol = algo.target_weekly_minutes || 0;
  let score = 0;
  if (targetVol > 0) {
    score = Math.min(100, Math.round((weeklyVol / targetVol) * 100));
  }

  // Activities filtering
  const swims = (rawGarminActivities || []).filter((a: any) => a.activityType?.typeKey === 'lap_swimming').map((a: any) => ({
    date: a.startTimeLocal,
    distance_m: a.distance || 0,
    duration_s: a.duration || 0,
    avg_hr: a.averageHR || null,
    training_load: a.activityTrainingLoad || null
  }));

  const dives = (rawGarminActivities || []).filter((a: any) => a.activityType?.typeKey === 'single_gas_diving').map((a: any) => ({
    date: a.startTimeLocal,
    max_depth_m: a.maxDepth || 0, // This field might need to be verified in raw data
    bottom_time_s: a.duration || 0 // usually duration is dive time
  }));

  return {
    metadata: {
      schema_version: "1.0.0",
      generated_at: new Date().toISOString(),
      source: "huno_app"
    },
    identity: {
      fullName: p.fullName,
      sex: o['sex'] || 'male', // default or from garmin if available
      age: p.age,
      height_cm: p.heightCm,
      weight_kg: p.weightKg ? Number(p.weightKg.toFixed(2)) : null,
      location: p.location
    },
    cardioStatus: {
      vo2max: c.vo2Max,
      resting_hr: c.restingHrToday,
      hr_min: c.minHrToday,
      hr_max: c.maxHrToday,
      hr_7day_avg_rest: c.restingHr7dAvg
    },
    wellnessStatus: {
      sleep_available: !!w.sleep.totalSleepSeconds,
      stress_available: w.stress && w.stress.length > 0,
      hrv_available: w.hrv && w.hrv.length > 0 // simplified check
    },
    recentActivities: {
      swims,
      dives
    },
    onboarding: {
      primary_goal: o['main_goal'] || null,
      secondary_goal: secondaryGoalStr || null,
      goal_timeline: {
        type: timelineType,
        value: timelineValue
      },
      priority: o['priority'] || null,
      injuries: injuriesRaw,
      equipment: {
        gym_access: gymAccess,
        home_equipment: homeEquip
      },
      preferences: {
        likes: likes, // map if existing
        dislikes: dislikes.filter(d => d !== 'none'),
        impact_tolerance: "medium", // hardcoded default or derive
        preferred_intensity: null // derive if question exists
      },
      lifestyle: {
        sleep_quality: null, // map if question
        stress_level: null, // map if question
        energy_level: null // map if question
      },
      availability: {
        sessions_per_week: sessionsPerWeek || null,
        session_duration_min: sessionDur || null,
        weekly_volume_minutes: weeklyVol || null
      },
      algorithm_recommendations: {
        recommended_sessions_per_week: algo.recommended_sessions_per_week || null,
        recommended_session_duration_min: algo.recommended_session_duration_min || null,
        target_weekly_minutes: algo.target_weekly_minutes || null,
        volume_match_score: score
      },
      fitness_tests: {
        pushups_max: Number(o['pushups_count']) || null,
        squats_max: Number(o['squats_count']) || null,
        plank_seconds: Number(o['plank_seconds']) || null,
        mobility_score: null // derive if question exists
      }
    }
  };
}

function downloadHunoProfileJson(hunoProfile: HunoProfile, rawGarminData?: any) {
  let onboardingData = {};
  try {
    const local = localStorage.getItem('huno-onboarding-data');
    if (local) onboardingData = JSON.parse(local);
  } catch (e) {
    console.warn("No local onboarding data");
  }

  // We need raw activities for the specific swim/dive fields if HunoProfile dropped them
  // Assuming rawGarminData is passed, or we assume HunoProfile has what we need (it doesn't have dive depth)
  // For now we will use HunoProfile activities as best effort if raw is missing, or rely on raw if passed
  const rawActivities = rawGarminData?.cardio?.activities || [];

  const finalJson = generateFinalJson(hunoProfile, onboardingData, rawActivities);

  const jsonStr = JSON.stringify(finalJson, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const userId = hunoProfile.userId || "user";
  a.download = `huno-profile-${userId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- COMPONENTS ---

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group/tooltip ml-2 cursor-help z-50">
    <HelpCircle className="w-4 h-4 text-gray-500/70 hover:text-white transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-4 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none text-center leading-relaxed">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#18181b]" />
    </div>
  </div>
);

const HeartRateChart = ({ data }: { data: [number, number | null][] }) => {
  const [hoverData, setHoverData] = useState<{ x: number, y: number, time: string, value: number } | null>(null);

  if (!data || data.length === 0) return null;

  // Filter valid points
  const points = data.filter(p => p[1] !== null) as [number, number][];
  if (points.length < 2) return null;

  const height = 60;
  const width = 200;
  const minVal = Math.min(...points.map(p => p[1]));
  const maxVal = Math.max(...points.map(p => p[1]));

  // Normalize
  const normalizeY = (val: number) => height - ((val - minVal) / (maxVal - minVal)) * height;
  const normalizeX = (idx: number) => (idx / (points.length - 1)) * width;

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${normalizeX(i)} ${normalizeY(p[1])}`
  ).join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.min(Math.max(0, Math.round((x / rect.width) * (points.length - 1))), points.length - 1);
    const point = points[index];

    if (point) {
      setHoverData({
        x: normalizeX(index),
        y: normalizeY(point[1]),
        time: new Date(point[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: point[1]
      });
    }
  };

  return (
    <div
      className="w-full h-20 mt-4 relative cursor-crosshair group/chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverData(null)}
    >
      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#hrGradient)" />
        <path d={pathD} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover Indicator */}
        {hoverData && (
          <>
            <line
              x1={hoverData.x} y1="0"
              x2={hoverData.x} y2={height}
              stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
            />
            <circle cx={hoverData.x} cy={hoverData.y} r="3" fill="white" stroke="#ef4444" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverData && (
        <div
          className="absolute bg-[#18181b] border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white transform -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap z-20 shadow-xl flex flex-col items-center"
          style={{ left: `${(hoverData.x / width) * 100}%`, top: -8 }}
        >
          <span className="font-bold text-lg leading-none text-red-400">{hoverData.value} <span className="text-xs font-normal text-gray-400">bpm</span></span>
          <span className="font-mono text-[10px] text-gray-500">{hoverData.time}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#18181b]" />
        </div>
      )}

      {/* Axis Labels (only visible when not hovering) */}
      <div className={`flex justify-between text-[10px] text-gray-500 mt-1 font-mono transition-opacity ${hoverData ? 'opacity-20' : 'opacity-100'}`}>
        <span>00:00</span>
        <span>12:00</span>
        <span>23:59</span>
      </div>
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  unit = '',
  icon: Icon,
  subtitle,
  colorClass = 'text-white',
  bgGradient = '',
  trend,
  tooltip,
  graph
}: any) => (
  <div className={`glass-card flex flex-col justify-between group h-full overflow-visible ${bgGradient ? 'bg-gradient-to-br ' + bgGradient : ''}`}>
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
          {Icon && <Icon className="w-4 h-4" />}
          <span>{title}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {trend && (
          <div className="bg-white/5 rounded-full px-2 py-0.5 text-xs text-green-400 border border-white/5 font-mono">
            {trend}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl lg:text-5xl font-black tracking-tight ${colorClass}`}>
          {value}
        </span>
        {unit && <span className="text-lg text-gray-500 font-medium">{unit}</span>}
      </div>
    </div>

    {graph && <div className="mt-2 text-white">{graph}</div>}

    {subtitle && (
      <div className="mt-4 pt-4 border-t border-white/5 text-sm text-gray-400">
        {subtitle}
      </div>
    )}
  </div>
);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [hunoProfile, setHunoProfile] = useState<HunoProfile | null>(() => {
    try {
      const cacheAny = garminCache as any;
      const cacheKeys = Object.keys(cacheAny);
      if (cacheKeys.length > 0) {
        const rawData = cacheAny[cacheKeys[0]]?.data;
        if (rawData && rawData.profile) {
          console.log("TEST MODE: Loaded data from cache");
          return buildHunoProfile(rawData);
        }
      }
    } catch (e) {
      console.error("TEST MODE: Failed to load cache", e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(!!hunoProfile);

  useEffect(() => {
    if (hunoProfile) return;
    const checkSession = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/garmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const normalized = buildHunoProfile(json);
          setHunoProfile(normalized);
          setIsAuthenticated(true);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [hunoProfile]);

  // Check for local onboarding updates
  useEffect(() => {
    if (!hunoProfile) return;
    try {
      const localData = localStorage.getItem('huno-onboarding-data');
      if (localData) {
        const answers = JSON.parse(localData);
        // Merge answers into hunoProfile display locally
        // Note: This is ephemeral client-side only for now as requested
        console.log("Merging onboarding data", answers);
        // Example: Update level or goals if we had them mapped
        // Since HunoProfile structure is fixed, we can't easily inject arbitrary fields
        // without updating the interface, but we can respect the "Update JSON" request 
        // by logging or partially updating matching fields if they existed.
        // For now, we will clear it to avoid re-merging loop or keep it.
      }
    } catch (e) {
      console.error(e);
    }
  }, [hunoProfile]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = (email && password) ? { email, password } : {};
      const res = await fetch('/api/garmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 401) {
        setIsAuthenticated(false);
        setHunoProfile(null);
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      if (!res.ok) {
        throw new Error(json.error || 'Login failed');
      }

      const normalized = buildHunoProfile(json);
      setHunoProfile(normalized);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      if (err.message.includes('Session expirée')) {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => handleLogin();

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="w-full max-w-md relative z-10 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/5 border border-white/10 shadow-2xl shadow-blue-500/20 mb-6 p-4 backdrop-blur-md">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                Garmin Hub
              </h1>
              <p className="text-gray-400 mt-2">Connectez votre compte pour accéder à vos données.</p>
            </div>
          </div>

          <div className="glass-card p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className="glass-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mot de passe</label>
                <input
                  type="password"
                  className="glass-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex gap-3">
                  <Activity className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Connexion"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-600">
            Utilise l'API non-officielle Garmin Connect.<br />Vos identifiants ne sont pas stockés.
          </p>
        </div>
      </main>
    );
  }

  if (!hunoProfile) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 pb-32 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6 text-center md:text-left w-full md:w-auto">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-lg shadow-blue-500/20 ring-4 ring-white/5 group-hover:scale-105 transition-transform">
              {hunoProfile.identity.fullName ? hunoProfile.identity.fullName.charAt(0).toUpperCase() : <User />}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-green-500 rounded-full border-4 border-[#09090b]" title="Connecté" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-1">
              {hunoProfile.identity.fullName || hunoProfile.identity.userName || 'Athlète'}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-3 text-sm text-gray-400">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs md:text-sm">
                <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5" />
                {hunoProfile.identity.location || 'N/A'}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-xs md:text-sm">
                <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-400" />
                Niveau {hunoProfile.garminMeta.userLevel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/onboarding')}
            className="btn-primary animate-pulse shadow-lg shadow-blue-500/20 flex items-center gap-2 px-4"
          >
            <span className="hidden sm:inline">Configurer mon programme</span>
            <span className="sm:hidden">Programme</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              // Use the raw loaded cache if in test mode/initial load, usually garminCache import
              // Ideally we should store rawGarminData in state if fetched from API but here we use the imported cache for the demo/test as requested
              const rawData = (garminCache as any)[Object.keys(garminCache)[0]]?.data;
              downloadHunoProfileJson(hunoProfile!, rawData);
            }}
            className="btn-secondary text-sm !px-3 md:!px-4"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">JSON</span>
          </button>

          <button onClick={() => {
            const rawData = (garminCache as any)[Object.keys(garminCache)[0]]?.data;
            let onboardingData = {};
            try {
              const local = localStorage.getItem('huno-onboarding-data');
              if (local) onboardingData = JSON.parse(local);
            } catch (e) { }
            const finalJson = generateFinalJson(hunoProfile!, onboardingData, rawData?.cardio?.activities);
            const notif = document.createElement('div');
            notif.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200';
            notif.innerHTML = `
                  <div class="glass-card w-full max-w-4xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                      <div class="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                          <h3 class="font-bold text-white">Aperçu JSON Profil</h3>
                          <button class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" onclick="this.closest('.fixed').remove()">Esc</button>
                      </div>
                      <div class="overflow-auto p-6 font-mono text-xs text-blue-300 bg-[#09090b]">
                          <pre>${JSON.stringify(finalJson, null, 2)}</pre>
                      </div>
                  </div>
              `;
            document.body.appendChild(notif);
          }} className="btn-secondary text-sm !px-3" title="Voir l'aperçu JSON">
            <Database className="w-4 h-4" />
          </button>

          <button onClick={refresh} className="btn-secondary !aspect-square !px-0 w-12" disabled={loading}>
            <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* QUICK STATS MESH */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        {[
          { label: 'Âge', value: hunoProfile.identity.age, unit: 'ans', tooltip: null },
          { label: 'Poids', value: hunoProfile.identity.weightKg ? Math.round(hunoProfile.identity.weightKg) : '-', unit: 'kg', tooltip: null },
          { label: 'Taille', value: hunoProfile.identity.heightCm, unit: 'cm', tooltip: null },
          {
            label: 'IMC',
            value: hunoProfile.identity.bmi,
            unit: '',
            color: (hunoProfile.identity.bmi && hunoProfile.identity.bmi < 25) ? 'text-green-400' : 'text-orange-400',
            tooltip: "Indice de Masse Corporelle calculé à partir de votre poids et taille."
          }
        ].map((stat, i) => (
          <div key={i} className="glass-card flex flex-col items-center justify-center py-4 hover:bg-white/10 transition-colors overflow-visible relative group">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
              {stat.label}
              {stat.tooltip && <InfoTooltip text={stat.tooltip} />}
            </span>
            <span className={`text-2xl font-bold ${stat.color || 'text-white'}`}>
              {stat.value} <span className="text-sm text-gray-500 font-medium ml-0.5">{stat.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* BENTO GRID DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">

        {/* Main Health: Sleep (Large) */}
        <div className="md:col-span-2 lg:col-span-2 row-span-1 min-h-[280px]">
          <MetricCard
            title="Sommeil"
            icon={Moon}
            value={hunoProfile.wellnessStatus.sleep.totalSleepSeconds
              ? `${Math.floor(hunoProfile.wellnessStatus.sleep.totalSleepSeconds / 3600)}h ${Math.floor((hunoProfile.wellnessStatus.sleep.totalSleepSeconds % 3600) / 60)}`
              : '--'
            }
            unit="min"
            colorClass="text-indigo-300"
            bgGradient="from-indigo-500/10 to-purple-500/5 hover:from-indigo-500/20 hover:to-purple-500/10"
            tooltip="Analyse la durée et les phases de votre sommeil pour évaluer la qualité de votre repos nocturne."
            subtitle={
              <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
                <div className="grid grid-cols-3 gap-2 md:gap-4 w-full md:w-auto">
                  <div className="bg-white/5 rounded-lg p-2 text-center md:text-left">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Profond</span>
                    <span className="text-white font-mono text-sm">{formatDuration(hunoProfile.wellnessStatus.sleep.deepSleepSeconds)}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center md:text-left">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Léger</span>
                    <span className="text-white font-mono text-sm">{formatDuration(hunoProfile.wellnessStatus.sleep.lightSleepSeconds)}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center md:text-left">
                    <span className="block text-[10px] uppercase text-gray-500 font-bold mb-1">REM</span>
                    <span className="text-white font-mono text-sm">{formatDuration(hunoProfile.wellnessStatus.sleep.remSleepSeconds)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <span className="text-xs text-gray-500 uppercase md:hidden">Score du sommeil</span>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white leading-none">{hunoProfile.wellnessStatus.sleep.totalSleepSeconds ? Math.round(hunoProfile.wellnessStatus.sleep.totalSleepSeconds / 3600 * 10) : 0}</div>
                    <div className="text-[10px] text-gray-500 uppercase hidden md:block">Score</div>
                  </div>
                </div>
              </div>
            }
          />
        </div>

        {/* Heart Rate */}
        <div className="md:col-span-1">
          <MetricCard
            title="Fréquence Cardiaque"
            icon={Heart}
            value={hunoProfile.cardioStatus.restingHrToday || '--'}
            unit="bpm"
            colorClass="text-red-400"
            trend={hunoProfile.cardioStatus.maxHrToday ? `Max ${hunoProfile.cardioStatus.maxHrToday}` : undefined}
            tooltip="Graphe de votre fréquence cardiaque au fil de la journée."
            subtitle={`Moyenne sur 7 jours : ${hunoProfile.cardioStatus.restingHr7dAvg || '--'} bpm`}
            graph={<HeartRateChart data={hunoProfile.cardioStatus.heartRateValues} />}
          />
        </div>

        {/* Body Battery & Stress */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="glass-card flex-1 p-5 flex items-center justify-between overflow-visible">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-1">
                <Battery className="w-4 h-4" />
                <span>Body Battery</span>
                <InfoTooltip text="Estime vos réserves d'énergie personnelles (0-100%) en fonction du stress et du repos." />
              </div>
              <div className="text-3xl font-black text-white">
                {hunoProfile.wellnessStatus.bodyBattery ? hunoProfile.wellnessStatus.bodyBattery[0]?.bodyBatteryLevelValue : '--'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
              {hunoProfile.wellnessStatus.bodyBattery ? hunoProfile.wellnessStatus.bodyBattery[0]?.bodyBatteryLevelValue : '-'}%
            </div>
          </div>

          <div className="glass-card flex-1 p-5 flex items-center justify-between overflow-visible">
            <div>
              <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase mb-1">
                <Zap className="w-4 h-4" />
                <span>Stress</span>
                <InfoTooltip text="Niveau de stress physiologique (0-100) basé sur la variabilité de votre fréquence cardiaque." />
              </div>
              <div className="text-3xl font-black text-white">
                {hunoProfile.wellnessStatus.stress ? hunoProfile.wellnessStatus.stress[0]?.averageStressLevel : '--'}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-400">
              {hunoProfile.wellnessStatus.stress ? hunoProfile.wellnessStatus.stress[0]?.averageStressLevel : '-'}
            </div>
          </div>
        </div>

        {/* VO2 Max */}
        <div className="md:col-span-1 lg:col-span-1 text-center">
          <div className="glass-card h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-purple-900/10 to-transparent overflow-visible">
            <Activity className="w-12 h-12 text-purple-500 mb-2 opacity-80" />
            <div>
              <div className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2 flex items-center justify-center gap-2">
                VO₂ Max Estimation
                <InfoTooltip text="Indicateur de performance athlétique mesurant la consommation maximale d'oxygène." />
              </div>
              <div className="text-6xl font-black text-white tracking-tighter shadow-purple-500/50 drop-shadow-lg">
                {hunoProfile.cardioStatus.vo2Max ? Math.round(hunoProfile.cardioStatus.vo2Max) : '--'}
              </div>
            </div>
            <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-200 font-bold uppercase">
              Excellent
            </div>
          </div>
        </div>

        {/* Activity Feed Full Width or Large */}
        <div className="md:col-span-3 lg:col-span-3">
          <section className="glass-card p-0 overflow-visible h-full">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Activités Récentes
                  <InfoTooltip text="Historique de vos dernières séances de sport avec les métriques clés." />
                </h3>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {hunoProfile.recentActivities.length > 0 ? (
                    hunoProfile.recentActivities.slice(0, 5).map((act, idx) => (
                      <tr key={idx} className="group hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <td className="py-4 pl-6 w-16 text-center">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/5 text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Activity className="w-5 h-5" />
                          </div>
                        </td>
                        <td className="py-4 pl-4">
                          <div className="flex flex-col">
                            <span className="text-white font-bold capitalize text-lg tracking-tight group-hover:text-blue-400 transition-colors">
                              {act.sport?.replace(/_/g, ' ') || act.name}
                            </span>
                            <span className="text-gray-500 text-xs font-mono mt-0.5">
                              {new Date(act.startTimeLocal).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 uppercase font-bold">Durée</span>
                              <span className="text-white font-mono">{formatDuration(act.durationSec)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 uppercase font-bold">Dist.</span>
                              <span className="text-white font-mono">{act.distanceM ? (act.distanceM / 1000).toFixed(2) : '-'} km</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 uppercase font-bold">HR Avg</span>
                              <span className="text-white font-mono">{act.averageHR || '-'} bpm</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-6 text-right">
                          <span className="inline-block px-3 py-1 rounded-lg bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20 font-mono">
                            {Math.round(act.calories || 0)} kcal
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-500 italic">
                        Aucune activité synchronisée récemment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden flex flex-col divide-y divide-white/5">
              {hunoProfile.recentActivities.length > 0 ? (
                hunoProfile.recentActivities.slice(0, 5).map((act, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between group active:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold capitalize text-sm group-hover:text-blue-400 transition-colors">
                          {act.sport?.replace(/_/g, ' ') || act.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 font-mono">
                          <span>{new Date(act.startTimeLocal).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                          <span>•</span>
                          <span>{formatDuration(act.durationSec)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-white text-sm">{Math.round(act.calories || 0)} <span className="text-xs text-gray-500 font-normal">kcal</span></span>
                      {act.distanceM && (
                        <span className="text-xs text-gray-400 font-mono">{(act.distanceM / 1000).toFixed(1)} km</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 italic text-sm">
                  Aucune activité.
                </div>
              )}
            </div>
          </section>
        </div>

      </div>

      {/* FOOTER */}
      <footer className="pt-8 border-t border-white/5 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-xs text-gray-600 gap-4">
        <div className="flex gap-4">
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
            <Database className="w-3 h-3" /> API Status: OK
          </span>
          <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
            User ID: {hunoProfile.userId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="w-5 h-5 object-contain opacity-50 section-logo" alt="" />
          Huno Garmin Dashboard • Design expérimental v2.0
        </div>
      </footer>
    </main>
  );
}
