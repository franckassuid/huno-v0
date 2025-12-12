import { NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';

// --- PROXY CONFIGURATION START ---
// Usually, we should configure this only once, but Next.js routes are tricky.
// We'll check if PROXY_URL is set and if global-agent is already active.
// Note: 'garmin-connect' uses 'axios' or similar http clients under the hood. 
// 'global-agent' helps to intercept http/https requests globally.
if (process.env.PROXY_URL) {
    try {
        const { bootstrap } = require('global-agent');

        // Only bootstrap if not already configured (though safe to call multiple times generally)
        if (!(global as any).GLOBAL_AGENT) {
            console.log("Initializing Global Proxy Agent with:", process.env.PROXY_URL.replace(/:[^:]*@/, ':***@')); // Hide password in logs
            process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.PROXY_URL;
            process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.PROXY_URL;
            bootstrap();
        }

        // DEBUG: Check IP
        try {
            // We use 'http' via global-agent (which intercepts http.request)
            // But simple fetch might bypass it if using Undici/native fetch in Node 18+
            // To be sure, we'll try to use a basic fetch and see if global-agent catches it
            // OR we rely on GarmiConnect logic.
            // Let's just try to fetch a public IP service.
            console.log("DEBUG: Checking outgoing IP...");
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipJson = await ipRes.json();
            console.log("DEBUG: Current Server IP is:", ipJson.ip);
        } catch (e) {
            console.error("DEBUG: Failed to check IP:", e);
        }
    } catch (e) {
        console.error("Failed to initialize proxy agent:", e);
    }
}
// --- PROXY CONFIGURATION END ---


// ... imports remain the same
// ... imports remain the same
export async function POST(request: Request) {
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
        const sessionFile = path.join(process.cwd(), 'session.json');

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
                // If invalid credentials, we should probably stop here
                throw loginErr;
            }
        }
        // SCENARIO 2: Auto-login / Refresh (No credentials, try session)
        else {
            const gcSession = new GarminConnect();
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

        // If we still don't have an active GC instance (no creds, no valid session file)
        if (!activeGc || !sessionLoaded) {
            return NextResponse.json({ error: 'Credentials required or session expired' }, { status: 401 });
        }

        // Use activeGc for subsequent calls
        const gcToUse = activeGc;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Cache Key (using email if available, otherwise 'session_user')
        const cacheUserKey = email || 'session_user';

        // --- CACHING STRATEGY ---
        const cacheFile = path.join(process.cwd(), 'garmin-cache.json');
        const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

        let cachedData: any = {};
        if (fs.existsSync(cacheFile)) {
            try {
                cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            } catch (e) { }
        }

        const cacheKey = `${cacheUserKey}-${todayStr}`;
        const userCache = cachedData[cacheKey];

        if (userCache && (Date.now() - userCache.timestamp < CACHE_DURATION)) {
            // console.log("Returning cached data");
            return NextResponse.json(userCache.data);
        }

        // Helper to be nice to the API
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // --- FETCHING ---
        // 1. PROFIL
        console.log("Fetching User Profile...");
        const userProfile = await gcToUse.getUserProfile();
        console.log("User Profile Keys:", Object.keys(userProfile || {}));

        await sleep(500);
        console.log("Fetching User Settings...");
        const userSettings = await gcToUse.getUserSettings();

        // DEBUG: Save raw data to file to inspect structure
        try {
            fs.writeFileSync(path.join(process.cwd(), 'garmin-debug.json'), JSON.stringify({
                userProfile,
                userSettings
            }, null, 2));
        } catch (e) { }

        console.log("User Settings Keys:", Object.keys(userSettings || {}));
        if (userSettings) console.log("User Settings Sample:", JSON.stringify(userSettings, null, 2).substring(0, 500)); // Log first 500 chars 

        // Weight is often in userSettings.userDataProfile.weight (in grams usually)

        // --- 2. CARDIO & FITNESS ---
        // VO2 Max
        let vo2MaxData = null;
        try {
            // @ts-ignore
            vo2MaxData = await gcToUse.client.get(`https://connect.garmin.com/metrics-service/metrics/maxmet/daily/${todayStr}/${todayStr}`);
        } catch (e) { }
        await sleep(500);

        // Fitness Age
        let fitnessData = null;
        try {
            // @ts-ignore
            fitnessData = await gcToUse.client.get(`https://connect.garmin.com/metrics-service/metrics/fitnessage/latest`);
        } catch (e) { }
        await sleep(500);

        // Heart Rate
        // @ts-ignore
        const heartRate = await gcToUse.getHeartRate(today);
        await sleep(500);

        // Activities
        const activities = await gcToUse.getActivities(0, 5);
        await sleep(500);

        // --- 3. SOMMEIL ---
        // @ts-ignore
        const sleepData = await gcToUse.getSleepData(today);
        await sleep(500);

        // --- 4. WELLNESS ---
        // Body Battery
        let bodyBattery = null;
        try {
            // @ts-ignore
            bodyBattery = await gcToUse.client.get(`https://connect.garmin.com/wellness-service/wellness/dailyBodyBattery/${todayStr}/${todayStr}`);
        } catch (e) { }
        await sleep(500);

        // Stress
        let stress = null;
        try {
            // @ts-ignore
            stress = await gcToUse.client.get(`https://connect.garmin.com/wellness-service/wellness/dailyStress/${todayStr}/${todayStr}`);
        } catch (e) { }
        await sleep(300);

        // HRV
        let hrvStatus = null;
        try {
            // @ts-ignore
            hrvStatus = await gcToUse.client.get(`https://connect.garmin.com/hrv-service/hrv/daily/${todayStr}/${todayStr}`);
        } catch (e) { }
        await sleep(300);

        // --- 5. LIFESTYLE ---
        // Daily Summary
        let dailySummary = null;
        try {
            // @ts-ignore
            const summaries = await gcToUse.client.get(`https://connect.garmin.com/usersummary-service/usersummary/daily/${todayStr}/${todayStr}`);
            if (Array.isArray(summaries) && summaries.length > 0) {
                dailySummary = summaries[0];
            }
        } catch (e) { }

        // Helper to calculate age from birthDate
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
                weight: userSettings?.userData?.weight, // grams based on debug file
                // @ts-ignore
                height: userSettings?.userData?.height, // cm
                // @ts-ignore
                age: calculateAge(userSettings?.userData?.birthDate),
            },
            cardio: {
                // @ts-ignore
                vo2Max: vo2MaxData || (userSettings?.userData?.vo2MaxRunning ? [{ vo2MaxPrecise: userSettings.userData.vo2MaxRunning }] : null),
                fitnessAge: fitnessData,
                heartRate: heartRate,
                activities: activities
            },
            sleep: sleepData,
            wellness: {
                bodyBattery,
                stress,
                hrv: hrvStatus
            },
            lifestyle: {
                summary: dailySummary
            }
        };

        // Save to cache
        cachedData[cacheKey] = {
            timestamp: Date.now(),
            data: responseData
        };
        try {
            fs.writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2));
        } catch (e) { }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Garmin API Error:', error);

        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('Missing credentials') || errorMessage.includes('401')) {
            return NextResponse.json({
                error: 'Session expirée',
                details: 'Veuillez vous reconnecter (credentials manquants pour refresh auto).'
            }, { status: 401 });
        }

        return NextResponse.json({
            error: 'Garmin Connection Error (Possible Rate Limit)',
            details: errorMessage
        }, { status: 500 });
    }
}
