'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, MapPin, TrendingUp, ChevronRight, Loader2, Play, Database,
  Moon, Heart, Battery, Zap, Activity, Flame, Footprints, Settings,
  Calendar, Timer, Dumbbell
} from 'lucide-react';
import garminCache from '../../garmin-cache.json';
import { buildHunoProfile, generateFinalJson, HunoProfile } from '../lib/garmin-utils';
import { InfoTooltip } from '../components/InfoTooltip';
import { CircularProgress } from '../components/CircularProgress';
import { MetricCard } from '../components/MetricCard';
import { HeartRateChart } from '../components/HeartRateChart';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hunoProfile, setHunoProfile] = useState<HunoProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Auth persistence check
    const mode = localStorage.getItem('huno-mode');
    if (mode === 'demo') {
      activateDemoMode();
    } else if (mode === 'live') {
      // Try local cache first
      try {
        const cached = localStorage.getItem('huno-data-cache');
        if (cached) {
          const json = JSON.parse(cached);
          console.log("🔥 LOADING FROM CACHE (No Fetch)");
          setHunoProfile(buildHunoProfile(json));
          setIsAuthenticated(true);
          return; // Stop here, no need to fetch
        }
      } catch (e) { }

      setIsRestoring(true);
      fetch('/api/garmin/data', { method: 'POST', body: JSON.stringify({}) })
        .then(async res => {
          if (res.ok) {
            const json = await res.json();
            console.log("🔥 GARMIN API RESPONSE (Session Restore):", json);
            setHunoProfile(buildHunoProfile(json));
            setIsAuthenticated(true);
            localStorage.setItem('huno-data-cache', JSON.stringify(json));
          } else {
            localStorage.removeItem('huno-mode');
          }
        })
        .catch(() => localStorage.removeItem('huno-mode'))
        .finally(() => setIsRestoring(false));
    }

    const savedEmail = localStorage.getItem('huno-saved-email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    if (rememberMe) localStorage.setItem('huno-saved-email', email);
    else localStorage.removeItem('huno-saved-email');

    try {
      const payload = (email && password) ? { email, password } : {};
      const res = await fetch('/api/garmin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.status === 401) throw new Error(json.error || "Session expirée.");
      if (!res.ok) throw new Error(json.error || 'Login failed');

      console.log("🔥 GARMIN API RESPONSE (Login):", json);
      setHunoProfile(buildHunoProfile(json));
      setIsAuthenticated(true);
      localStorage.setItem('huno-mode', 'live');
      localStorage.setItem('huno-data-cache', JSON.stringify(json));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activateDemoMode = () => {
    try {
      const cacheAny = garminCache as any;
      const keys = Object.keys(cacheAny);
      if (keys.length > 0) {
        const rawData = cacheAny[keys[0]]?.data;
        if (rawData) {
          setHunoProfile(buildHunoProfile(rawData));
          setIsAuthenticated(true);
          localStorage.setItem('huno-mode', 'demo');
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (!isAuthenticated) {
    // LOGIN SCREEN (Unchanged style for now, focusing on Dashboard redesign)
    return (
      <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div className="w-full max-w-md relative z-10 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/5 border border-white/10 shadow-2xl shadow-blue-500/20 mb-6 p-4 backdrop-blur-md">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Huno</h1>
              <p className="text-lg text-gray-300 font-medium">Fitness that fits you</p>
            </div>
          </div>
          <div className="glass-card p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</label>
                <input type="email" className="glass-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="exemple@email.com" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mot de passe</label>
                <input type="password" className="glass-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-white/10 bg-white/5 text-blue-600" />
                <label htmlFor="rememberMe" className="text-sm text-gray-400 cursor-pointer">Se souvenir de moi</label>
              </div>
              {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? <Loader2 className="animate-spin" /> : "Connexion"}</button>
              <button type="button" onClick={activateDemoMode} className="btn-secondary w-full">Mode Démo</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (!hunoProfile) return null;

  // --- DASHBOARD UI ---
  return (
    <main className="min-h-screen p-4 md:p-8 pb-32 max-w-5xl mx-auto space-y-10 font-sans">

      {/* 1. HEADER & PROFILE NAV */}
      <header className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-4">
          <div className="relative cursor-pointer group" onClick={() => router.push('/profile')}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 p-0.5 ring-2 ring-white/10 group-hover:ring-white/30 transition-all">
              <div className="w-full h-full rounded-full bg-[#09090b] flex items-center justify-center overflow-hidden">
                {hunoProfile.identity.fullName ? (
                  <span className="text-lg font-bold text-white">{hunoProfile.identity.fullName.charAt(0)}</span>
                ) : <User className="text-gray-400 w-5 h-5" />}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#09090b] rounded-full"></div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Bonjour, {hunoProfile.identity.fullName?.split(' ')[0] || 'Athlète'}</h2>
            <p className="text-sm text-gray-400 font-medium">Prêt à vous dépasser ?</p>
          </div>
        </div>

        <button onClick={() => router.push('/profile')} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5">
          <User className="w-5 h-5" />
        </button>
      </header>

      {/* 2. ACTIONS HERO */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">

        {/* TRAINING CARD (Hero - 3 cols) */}
        <div className="md:col-span-3 glass-card relative overflow-hidden group border-white/5 hover:border-blue-500/20 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-transparent group-hover:from-blue-900/20 transition-all duration-500" />

          <div className="p-8 relative z-10 flex flex-col justify-between h-full min-h-[320px]">
            <div className="flex justify-between items-start">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-500/20">
                <Calendar className="w-3 h-3" /> Aujourd'hui
              </span>
              <Timer className="w-5 h-5 text-gray-500" />
            </div>

            <div className="space-y-3 mt-4">
              <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
                Endurance <br />Fondamentale
              </h1>
              <div className="flex items-center gap-4 text-gray-400 text-sm font-medium">
                <span className="flex items-center gap-1.5"><Timer className="w-4 h-4" /> 45 min</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-400" /> Intensité Basse</span>
              </div>
            </div>

            <div className="mt-8 pt-8 flex items-center gap-4">
              <button
                onClick={() => router.push('/training')}
                className="flex-grow bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg py-4 px-8 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all duration-200"
              >
                <Play className="w-5 h-5 fill-current" />
                Lancer
              </button>
              <button className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-white/5 group/cal">
                <Calendar className="w-6 h-6 group-hover/cal:text-blue-300 transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* FORME DU JOUR (Side Hero - 2 cols) */}
        <div className="md:col-span-2 glass-card p-6 flex flex-col justify-between relative overflow-hidden bg-[#09090b]/50 border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-lg">Forme du jour</h3>
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Optimale</span>
          </div>

          <div className="flex-grow flex flex-col items-center justify-center py-2">
            <div className="relative w-40 h-40">
              {/* Background Ring */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="50%" cy="50%" r="68" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                {/* Progress Ring */}
                <circle
                  cx="50%" cy="50%" r="68"
                  stroke="url(#gradient-readiness)"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={427}
                  strokeDashoffset={427 - (427 * 70) / 100}
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                />
                <defs>
                  <linearGradient id="gradient-readiness" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-white tracking-tighter">70</span>
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Readiness</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Body Battery</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-bold text-blue-400 leading-none">
                  {hunoProfile.wellnessStatus.bodyBattery && hunoProfile.wellnessStatus.bodyBattery[0]?.bodyBatteryValuesArray
                    ? hunoProfile.wellnessStatus.bodyBattery[0].bodyBatteryValuesArray.slice(-1)[0][1]
                    : (hunoProfile.wellnessStatus.bodyBattery?.[0]?.bodyBatteryLevelValue ?? '--')}
                </span>
                <span className="text-xs text-blue-500/60 font-medium mb-0.5">%</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Repos</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-bold text-emerald-400 leading-none">OK</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CONTEXT ROW */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">

        {/* Sommeil */}
        <button className="glass-card p-4 flex flex-col gap-3 hover:bg-white/5 transition-all text-left group">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:text-indigo-300 transition-colors"><Moon className="w-5 h-5" /></div>
            <span className={`text-lg font-bold ${(hunoProfile.wellnessStatus.sleep.totalSleepSeconds || 0) > 25000 ? 'text-indigo-400' : 'text-orange-400'
              }`}>
              {hunoProfile.wellnessStatus.sleep.totalSleepSeconds
                ? Math.min(100, Math.round((hunoProfile.wellnessStatus.sleep.totalSleepSeconds / 28800) * 85))
                : '--'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Sommeil</span>
            <div className="text-white font-semibold text-sm mt-0.5">{formatDuration(hunoProfile.wellnessStatus.sleep.totalSleepSeconds)}</div>
          </div>
        </button>

        {/* Aujourd'hui */}
        <div className="glass-card p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><Footprints className="w-5 h-5" /></div>
            <span className="text-lg font-bold text-white tracking-tight">
              {hunoProfile.dailySummary?.steps?.toLocaleString() || '--'}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Aujourd'hui</span>
            <div className="text-white font-semibold text-sm mt-0.5 truncate">
              {hunoProfile.dailySummary?.stepsGoal ? `${Math.round((hunoProfile.dailySummary.steps || 0) / hunoProfile.dailySummary.stepsGoal * 100)}% Objectif` : 'Pas de but'}
            </div>
          </div>
        </div>

        {/* Configuration (CTA) */}
        <button onClick={() => router.push('/onboarding')} className="glass-card p-4 flex flex-col gap-3 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group border border-dashed border-white/10">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-white/5 rounded-lg text-gray-400 group-hover:text-blue-400 transition-colors"><Settings className="w-5 h-5" /></div>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider group-hover:text-blue-300">Programme</span>
            <div className="text-white font-semibold text-sm mt-0.5 flex items-center gap-1 group-hover:text-blue-200">
              Configurer <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </button>

        {/* Plus */}
        <button onClick={() => router.push('/profile')} className="glass-card p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors text-left group">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-white/5 rounded-lg text-gray-400 group-hover:text-white transition-colors"><Activity className="w-5 h-5" /></div>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Insights</span>
            <div className="text-white font-semibold text-sm mt-0.5 group-hover:underline decoration-white/30 underline-offset-4">Voir tout</div>
          </div>
        </button>
      </section>

      {/* FOOTER */}
      <footer className="pt-8 text-center">
        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-widest">Huno • Experimental Build</p>
      </footer>
    </main>
  );
}
