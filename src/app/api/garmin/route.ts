import { NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';
import { garminFetch } from '@/lib/garmin-fetch';

// --- PROXY CONFIGURATION START ---
import { setGlobalDispatcher, ProxyAgent } from 'undici';

console.log(">>> VERCEL DIAGNOSTIC: Testing Environment Variables...");
console.log(">>> PROXY_URL Status:", process.env.PROXY_URL ? "PRESENT ✅" : "MISSING ❌");
if (process.env.PROXY_URL) {
    console.log(">>> PROXY_URL Value starts with:", process.env.PROXY_URL.substring(0, 10) + "...");
}

if (process.env.PROXY_URL) {
    try {
        const redactedUrl = process.env.PROXY_URL.replace(/:[^:]*@/, ':***@');
        console.log("Initializing Proxy Strategies with:", redactedUrl);

        // 1. Undici (For fetch - Node 18+)
        try {
            const proxyAgent = new ProxyAgent(process.env.PROXY_URL);
            setGlobalDispatcher(proxyAgent);
            console.log(" - Undici ProxyAgent set.");
        } catch (err) { console.error("Undici setup failed:", err); }

        // 2. Global Agent (For http/axios - Legacy Node)
        try {
            const { bootstrap } = require('global-agent');
            // Check if already active to avoid loops or errors
            if (!(global as any).GLOBAL_AGENT) {
                process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.PROXY_URL;
                process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.PROXY_URL;
                bootstrap();
                console.log(" - Global Agent bootstrapped.");
            }
        } catch (err) { console.error("Global Agent setup failed:", err); }

        // DEBUG: Check IP (using fetch)
        (async () => {
            try {
                console.log("DEBUG: Checking outgoing IP (via fetch)...");
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipJson = await ipRes.json();
                console.log("DEBUG: Current Server IP is:", ipJson.ip);
            } catch (e) {
                console.error("DEBUG: IP Check Failed:", e);
            }
        })();

    } catch (e) {
        console.error("Failed to initialize proxies:", e);
    }
}
// --- PROXY CONFIGURATION END ---

function logBootContext() {
    const context = {
        runtime: process.env.NEXT_RUNTIME || 'node',
        region: process.env.VERCEL_REGION || 'local',
        nodeVersion: process.version,
        proxyProvider: process.env.PROXY_URL ? 'configured' : 'none',
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentDateISO: new Date().toISOString()
    };
    console.log("BOOT CONTEXT:", JSON.stringify(context, null, 2));
}

export async function POST(request: Request) {
    logBootContext();
    try {
        let email = '';
        let password = '';

        try {
            const body = await request.json();
            email = body.email;
            password = body.password;
        } catch (e) {
            // Body might be empty if just refreshing session
        }

        const fs = require('fs');
        const path = require('path');
        const sessionFile = path.join('/tmp', 'session.json');

        let activeGc: any = null;
        let sessionLoaded = false;

        // SCENARIO 1: Explicit Login (Credentials provided)
        if (email && password) {
            console.log("Explicit login requested with credentials.");
            const gcWithCreds = new GarminConnect({ username: email, password });

            try {
                await gcWithCreds.login();
                // Login successful, save new session
                gcWithCreds.exportTokenToFile(sessionFile);
                console.log("Login successful. New session saved.");
                activeGc = gcWithCreds;
                sessionLoaded = true;
            } catch (loginErr) {
                console.error("Login failed:", loginErr);
                throw loginErr;
            }
        }
        // SCENARIO 2: Auto-login / Refresh (No credentials, try session)
        else {
            const gcSession = new GarminConnect({ username: 'dummy', password: 'password' });
            if (fs.existsSync(sessionFile)) {
                try {
                    console.log("Attempting to load session from file...");
                    gcSession.loadTokenByFile(sessionFile);
                    activeGc = gcSession;
                    sessionLoaded = true;
                    console.log("Session loaded successfully.");
                } catch (err) {
                    console.warn("Failed to load session file:", err);
                }
            }
        }

        if (!activeGc || !sessionLoaded) {
            return NextResponse.json({ error: 'Credentials required or session expired' }, { status: 401 });
        }

        const gcToUse = activeGc;

        // --- 3. FIX HEADERS (Browser-like) ---
        if (gcToUse.client && gcToUse.client.defaults && gcToUse.client.defaults.headers) {
            console.log("Injecting browser-like headers...");
            gcToUse.client.defaults.headers = {
                ...gcToUse.client.defaults.headers,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Referer': 'https://connect.garmin.com/', 
                'Accept': 'application/json, text/plain, */*',
                'nk': 'NT'
            };
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const cacheUserKey = email || 'session_user';

        // --- CACHING STRATEGY ---
        const cacheFile = path.join('/tmp', 'garmin-cache.json');
        const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
        const USE_CACHE = process.env.GARMIN_DEBUG !== '1'; // Disable cache in debug mode

        let cachedData: any = {};
        if (USE_CACHE && fs.existsSync(cacheFile)) {
            try {
                cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            } catch (e) { }
        }

        const cacheKey = `${cacheUserKey}-${todayStr}`;
        const userCache = cachedData[cacheKey];

        if (USE_CACHE && userCache && (Date.now() - userCache.timestamp < CACHE_DURATION)) {
            console.log("Returning cached data (duration check passed).");
            // return NextResponse.json(userCache.data); 
        }

        // Helper to be nice to the API
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // --- FETCHING ---
        console.log("Fetching User Profile...");
        const userProfile = await gcToUse.getUserProfile();
        // Use profileId (numeric) for wellness endpoints as displayName can be a UUID
        const userId = userProfile.profileId || userProfile.displayName;

        await sleep(200);
        console.log("Fetching User Settings...");
        const userSettings = await gcToUse.getUserSettings();

        // 1. ACTIVITIES (Manual)
        console.log("Fetching Activities...");
        let activities = [];
        try {
            const actData = await garminFetch({
                client: gcToUse.client,
                url: 'https://connect.garmin.com/modern/proxy/activitylist-service/activities/search/activities',
                featureName: 'activities',
                params: { limit: 20, start: 0 }
            });
            activities = actData;
        } catch (e) { console.error("Activities fetch failed", e); }


        // Helper for robust fetching
        const fetchWithFallback = async (label: string, featureName: string, urlBuilder: (date: string) => string, dates: string[]) => {
            for (const d of dates) {
                try {
                    const data = await garminFetch({
                        client: gcToUse.client,
                        url: urlBuilder(d),
                        featureName,
                        params: { date: d }
                    });

                    const isArray = Array.isArray(data);
                    const hasKeys = data && typeof data === 'object' && Object.keys(data).length > 0;

                    if (data && (isArray || hasKeys)) {
                        return { status: 'available', date: d, data: data };
                    }
                } catch (e) {
                    // garminFetch logs error, we just continue
                }
            }
            return { status: 'unavailable', data: null };
        };

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

        // 2. SLEEP (Manual with Fallback)
        console.log("Fetching Sleep Data...");
        const sleepResult = await fetchWithFallback(
            'Sleep',
            'dailyWellness.sleep',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailySleepData/${userId}`,
            [todayStr, yesterdayStr, twoDaysAgoStr]
        );

        // 3. HEART RATE
        console.log("Fetching Heart Rate...");
        const heartRateResult = await fetchWithFallback(
            'HeartRate',
            'dailyWellness.heartRate',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyHeartRate/${userId}`,
            [todayStr]
        );

        // 4. WELLNESS
        console.log("--- WELLNESS FETCHING (Robust Mode) ---");

        // A. Body Battery
        const bbResult = await fetchWithFallback('BodyBattery', 'dailyWellness.bodyBattery',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/bodyBattery/daily/${userId}`,
            [todayStr]
        );

        // B. Stress
        const stressResult = await fetchWithFallback('Stress', 'dailyWellness.stress',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyStress/${userId}`,
            [todayStr]
        );

        // C. HRV
        const hrvResult = await fetchWithFallback('HRV', 'dailyWellness.hrv',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/hrv/daily/${userId}`,
            [yesterdayStr, todayStr, twoDaysAgoStr]
        );

        // D. Daily Summary (Bonus)
        const summaryResult = await fetchWithFallback('DailySummary', 'dailyWellness.summary',
            (d) => `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userId}`,
            [todayStr]
        );


        const calculateAge = (birthDate: string) => {
            if (!birthDate) return null;
            const diff = Date.now() - new Date(birthDate).getTime();
            return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        };

        const responseData = {
            success: true,
            profile: {
                ...userProfile,
                // @ts-ignore
                weight: userSettings?.userData?.weight,
                // @ts-ignore
                height: userSettings?.userData?.height,
                // @ts-ignore
                age: calculateAge(userSettings?.userData?.birthDate),
            },
            cardio: {
                vo2Max: null,
                fitnessAge: null,
                heartRate: heartRateResult.data,
                activities: activities
            },
            wellness: {
                // Return structured objects with status
                sleep: sleepResult,
                bodyBattery: bbResult,
                stress: stressResult,
                hrv: hrvResult
            },
            lifestyle: {
                summary: summaryResult.data
            }
        };

        // Save to cache
        if (USE_CACHE) {
            cachedData[cacheKey] = {
                timestamp: Date.now(),
                data: responseData
            };
            try { fs.writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2)); } catch (e) { }
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('🔥 CRITICAL GARMIN API ERROR 🔥');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);

        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('Missing credentials') || errorMessage.includes('401')) {
            return NextResponse.json({
                error: 'Session expirée',
                details: 'Veuillez vous reconnecter (credentials manquants pour refresh auto).'
            }, { status: 401 });
        }

        return NextResponse.json({
            error: 'Garmin Connection Error',
            details: errorMessage,
            fullError: error.toString()
        }, { status: 500 });
    }
}
