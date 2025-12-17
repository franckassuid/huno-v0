'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    User, MapPin, TrendingUp, ChevronLeft, Loader2, Play, Database,
    Moon, Heart, Battery, Zap, Activity, Flame, LogOut
} from 'lucide-react';
import { HunoProfile } from '../../domain/types';
import { generateFinalJson } from '../../services/garmin/transformer';
import { InfoTooltip } from '../../components/InfoTooltip';
import { MetricCard } from '../../components/MetricCard';
import { CircularProgress } from '../../components/CircularProgress';
import { TimeSeriesChart } from '../../components/TimeSeriesChart';

export default function Profile() {
    const router = useRouter();
    const [profile, setProfile] = useState<HunoProfile | null>(null);
    const [rawData, setRawData] = useState<any>(null); // Still useful for download
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchData() {
            // 1. Try Cache 
            try {
                const cached = localStorage.getItem('huno-data-cache');
                if (cached) {
                    const json = JSON.parse(cached);
                    console.log("PROFILE: Loading from Cache");
                    setProfile(json);
                    setRawData(json);
                    setLoading(false);
                    return;
                }
            } catch (e) { }

            // 2. Fetch Live Data
            try {
                const res = await fetch('/api/garmin/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        throw new Error("Session expirée");
                    }
                    throw new Error("Erreur de chargement");
                }

                const json = await res.json();
                console.log("🔥 GARMIN API RESPONSE (Profile Fetch):", json);
                setProfile(json); // Already shaped
                setRawData(json);
            } catch (e: any) {
                console.error(e);
                setError(e.message);
                if (e.message === "Session expirée") {
                    setTimeout(() => router.push('/'), 2000);
                }
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [router]);

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[#09090b]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white gap-4">
                <p className="text-red-400">{error}</p>
                <button onClick={() => router.push('/')} className="text-blue-400 hover:underline">Retour à l'accueil</button>
            </main>
        );
    }

    if (!profile) return null;

    // Helper for formatting duration
    const formatDuration = (seconds?: number | null) => {
        if (!seconds) return '--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />

            {/* Header with Back Button */}
            <header className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-white">Mon Profil & Statistiques</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => {
                        // Create a blob and download it
                        const jsonStr = JSON.stringify(rawData, null, 2);
                        const blob = new Blob([jsonStr], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `garmin-data-${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white" title="Télécharger JSON">
                        <Database className="w-6 h-6" />
                    </button>
                    <button onClick={() => {
                        let onboardingData = {};
                        try {
                            const local = localStorage.getItem('huno-onboarding-data');
                            if (local) onboardingData = JSON.parse(local);
                        } catch (e) { }

                        const finalJson = generateFinalJson(profile, onboardingData);

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
                    }} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white" title="Voir JSON">
                        <Database className="w-6 h-6" />
                    </button>

                    <button
                        onClick={() => {
                            localStorage.removeItem('huno-mode');
                            localStorage.removeItem('huno-data-cache');
                            router.push('/');
                        }}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20"
                        title="Se déconnecter"
                    >
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Profile Identity Card */}
            <section className="glass-card p-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-visible z-10">
                {/* ... existing identity card content ... */}
                <div className="relative group shrink-0">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-4xl md:text-5xl font-bold text-white shadow-lg shadow-blue-500/20 ring-4 ring-white/5">
                        {profile.identity.fullName ? profile.identity.fullName.charAt(0).toUpperCase() : <User />}
                    </div>
                    {/* Device Photo Overlay */}
                    {profile.devices && profile.devices.length > 0 && (
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-[#18181b] rounded-xl border border-white/10 p-1 shadow-xl flex items-center justify-center overflow-hidden" title={profile.devices[0].productDisplayName}>
                            {/* Using a generic placeholder for specific device, or just the first device's image if available in URL (Garmin provides imageUrl sometimes) */}
                            {/* Since we don't have exact URLs, we'll try to use the one from device object if it exists, roughly */}
                            {/* For now, just a watch icon or the name */}
                            <img
                                src={`https://res.garmin.com/en/products/${profile.devices[0].partNumber}/v/cf-lg.jpg`}
                                onError={(e) => (e.currentTarget.src = 'https://static.garmincdn.com/en/products/010-02540-10/v/cf-md.jpg')}
                                alt="Device"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                </div>

                <div className="flex-grow text-center md:text-left space-y-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            {profile.identity.fullName || profile.identity.userName || 'Athlète'}
                        </h2>
                        <p className="text-gray-400 text-sm md:text-base flex items-center justify-center md:justify-start gap-2">
                            <MapPin className="w-4 h-4" />
                            {profile.identity.location || 'Localisation inconnue'}
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        {/* Gamification Data */}
                        {profile.garminMeta.userLevel !== null && (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
                                <TrendingUp className="w-4 h-4" />
                                Niveau {profile.garminMeta.userLevel}
                            </span>
                        )}
                        {profile.garminMeta.userPoints !== null && (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium">
                                {profile.garminMeta.userPoints} Points
                            </span>
                        )}
                    </div>

                    {/* Devices list */}
                    {profile.devices && profile.devices.length > 0 && (
                        <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                            {profile.devices.map((device: any, i: number) => (
                                <span key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400">
                                    <span className={`w-2 h-2 rounded-full ${device.wifiConnected ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                    {device.productDisplayName}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Physical Stats Grid */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {[
                    { label: 'Âge', value: profile.identity.age, unit: 'ans', color: 'text-white' },
                    { label: 'Poids', value: profile.identity.weightKg ? Math.round(profile.identity.weightKg) : '-', unit: 'kg', color: 'text-white' },
                    { label: 'Taille', value: profile.identity.heightCm, unit: 'cm', color: 'text-white' },
                    {
                        label: 'IMC',
                        value: profile.identity.bmi,
                        unit: '',
                        color: (profile.identity.bmi && profile.identity.bmi < 25) ? 'text-green-400' : 'text-orange-400',
                        tooltip: "Indice de Masse Corporelle"
                    }
                ].map((stat, i) => (
                    <div key={i} className="glass-card flex flex-col items-center justify-center py-6 hover:bg-white/10 transition-colors group">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
                            {stat.label}
                            {stat.tooltip && <InfoTooltip text={stat.tooltip} />}
                        </span>
                        <span className={`text-3xl font-black ${stat.color}`}>
                            {stat.value} <span className="text-sm text-gray-500 font-medium ml-0.5">{stat.unit}</span>
                        </span>
                    </div>
                ))}
            </section>

            {/* METRICS DASHBOARD (Moved from Home) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 relative z-10">

                {/* Steps Card */}
                <div className="md:col-span-1"> {/* Adjust grid span if needed */}
                    <MetricCard
                        title="Pas"
                        icon={Flame} // Or footsteps icon if available
                        value={profile.lifestyleStatus.steps || 0}
                        unit="pas"
                        colorClass="text-emerald-400"
                        tooltip="Nombre de pas effectués aujourd'hui."
                        subtitle={
                            <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>Hier: <span className="text-white font-mono">{(profile.lifestyleStatus as any).stepsYesterday || '--'}</span> pas</span>
                            </div>
                        }
                    />
                </div>

                {/* Main Health: Sleep (Large) */}
                <div className="md:col-span-2 lg:col-span-1 row-span-1"> {/* Adjusted span to fit steps */}
                    <MetricCard
                        title="Sommeil"
                        // ... (keep existing props)
                        icon={Moon}
                        value={profile.wellnessStatus.sleep.totalSleepSeconds
                            ? `${Math.floor(profile.wellnessStatus.sleep.totalSleepSeconds / 3600)}h ${Math.floor((profile.wellnessStatus.sleep.totalSleepSeconds % 3600) / 60)}`
                            : '--'
                        }
                        unit="min"
                        colorClass="text-indigo-300"
                        bgGradient="from-indigo-500/10 to-purple-500/5 hover:from-indigo-500/20 hover:to-purple-500/10"
                        tooltip="Analyse la durée et les phases de votre sommeil pour évaluer la qualité de votre repos nocturne."
                        subtitle={
                            <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                                    <div className="bg-white/5 rounded-lg p-3 sm:p-2 text-left">
                                        <span className="block text-xs uppercase text-gray-500 font-bold mb-1">Profond</span>
                                        <span className="text-white font-mono text-base sm:text-sm">{formatDuration(profile.wellnessStatus.sleep.deepSleepSeconds)}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 sm:p-2 text-left">
                                        <span className="block text-xs uppercase text-gray-500 font-bold mb-1">Léger</span>
                                        <span className="text-white font-mono text-base sm:text-sm">{formatDuration(profile.wellnessStatus.sleep.lightSleepSeconds)}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 sm:p-2 text-left">
                                        <span className="block text-xs uppercase text-gray-500 font-bold mb-1">REM</span>
                                        <span className="text-white font-mono text-base sm:text-sm">{formatDuration(profile.wellnessStatus.sleep.remSleepSeconds)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                                    <span className="text-xs text-gray-500 uppercase md:hidden">Score du sommeil</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-white leading-none">{profile.wellnessStatus.sleep.totalSleepSeconds ? Math.round(profile.wellnessStatus.sleep.totalSleepSeconds / 3600 * 10) : 0}</div>
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
                        value={profile.cardioStatus.restingHrToday || '--'}
                        unit="bpm"
                        colorClass="text-red-400"
                        trend={profile.cardioStatus.maxHrToday ? `Max ${profile.cardioStatus.maxHrToday}` : undefined}
                        tooltip="Graphe de votre fréquence cardiaque au fil de la journée."
                        subtitle={`Moyenne sur 7 jours : ${profile.cardioStatus.restingHr7dAvg || '--'} bpm`}
                        graph={
                            <TimeSeriesChart
                                data={profile.cardioStatus.heartRateValues}
                                color="#f87171"
                                unit="bpm"
                                minY={30}
                                maxY={190}
                            />
                        }
                    />
                </div>

                {/* Body Battery & Stress */}
                <div className="md:col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Body Battery */}
                    <MetricCard
                        title="Body Battery"
                        icon={Battery}
                        value={Array.isArray(profile.wellnessStatus.bodyBattery) && profile.wellnessStatus.bodyBattery.length > 0
                            ? profile.wellnessStatus.bodyBattery[profile.wellnessStatus.bodyBattery.length - 1].val
                            : '--'}
                        unit="%"
                        colorClass="text-blue-400"
                        bgGradient="from-blue-500/10 to-transparent hover:from-blue-500/20"
                        tooltip="Estime vos réserves d'énergie personnelles (0-100%) en fonction du stress et du repos."
                        graph={
                            <div className="h-24">
                                <TimeSeriesChart
                                    data={Array.isArray(profile.wellnessStatus.bodyBattery)
                                        ? profile.wellnessStatus.bodyBattery.map((p: any) => [p.date, p.val])
                                        : []}
                                    color="#60a5fa" // blue-400
                                    unit="%"
                                    minY={0}
                                    maxY={100}
                                    height={80}
                                />
                            </div>
                        }
                    />

                    {/* Stress */}
                    <MetricCard
                        title="Stress"
                        icon={Zap}
                        value={Array.isArray(profile.wellnessStatus.stress) && profile.wellnessStatus.stress.length > 0
                            ? profile.wellnessStatus.stress[profile.wellnessStatus.stress.length - 1].y
                            : '--'}
                        unit="/ 100"
                        colorClass="text-orange-400"
                        bgGradient="from-orange-500/10 to-transparent hover:from-orange-500/20"
                        tooltip="Niveau de stress physiologique (0-100) basé sur la variabilité de votre fréquence cardiaque."
                        graph={
                            <div className="h-24">
                                <TimeSeriesChart
                                    data={Array.isArray(profile.wellnessStatus.stress)
                                        ? profile.wellnessStatus.stress.map((p: any) => [p.x, p.y])
                                        : []}
                                    color="#fb923c" // orange-400
                                    unit=""
                                    minY={0}
                                    maxY={100}
                                    height={80}
                                />
                            </div>
                        }
                    />
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
                                {profile.cardioStatus.vo2Max ? Math.round(profile.cardioStatus.vo2Max) : '--'}
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
                                    {profile.recentActivities.length > 0 ? (
                                        profile.recentActivities.slice(0, 5).map((act, idx) => (
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

                        {/* Mobile List View - Card Style */}
                        <div className="md:hidden flex flex-col gap-3">
                            {profile.recentActivities.length > 0 ? (
                                profile.recentActivities.slice(0, 5).map((act, idx) => (
                                    <div key={idx} className="p-4 bg-white/5 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all border border-white/5">
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
            </div >
        </main>
    );
}
