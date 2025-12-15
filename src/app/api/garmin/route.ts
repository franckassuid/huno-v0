import { NextResponse } from 'next/server';
import { getAuthenticatedGarminClient } from '@/lib/garmin-client';
import { garminFetch } from '@/lib/garmin-fetch';
import fs from 'fs';
import path from 'path';

// Helper for boot context logging
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

const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

export async function POST(request: Request) {
    logBootContext();

    try {
        // --- 1. AUTHENTICATION ---
        let email = '';
        let password = '';
        try {
            const body = await request.json();
            email = body.email;
            password = body.password;
        } catch (e) { }

        // Use shared client factory
        const gc = await getAuthenticatedGarminClient(email, password);

        // --- CACHING SETUP ---
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const cacheUserKey = email || 'session_user';
        const cacheFile = path.join('/tmp', 'garmin-cache.json');
        const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
        const USE_CACHE = process.env.GARMIN_DEBUG !== '1';

        // Check Cache
        if (USE_CACHE && fs.existsSync(cacheFile)) {
            try {
                const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                const cacheKey = `${cacheUserKey}-${todayStr}`;
                const userCache = cachedData[cacheKey];
                if (userCache && (Date.now() - userCache.timestamp < CACHE_DURATION)) {
                    console.log("Returning cached data.");
                    return NextResponse.json(userCache.data);
                }
            } catch (e) { }
        }

        // --- FETCHING START ---

        // 1. Profile & Settings
        console.log("Fetching User Profile...");
        const userProfile = await gc.getUserProfile();
        // userProfile.profileId is long, displayName is string. 
        // Wellness endpoints usually prefer displayName or profileId? 
        // Empirically, new endpoints use numeric profileId, older ones displayName.
        // We will try numeric first if available.
        const userId = userProfile.profileId || userProfile.displayName;

        console.log(`User ID identified for calls: ${userId}`);

        // 2. Device Check (Step 4 of plan)
        console.log("Fetching User Devices...");
        try {
            const devices = await garminFetch({
                client: gc.client,
                url: `https://connect.garmin.com/modern/proxy/device-service/deviceservice/app-info/${userId}`,
                featureName: 'devices'
            });
            console.log("Devices Found:", Array.isArray(devices) ? devices.length : 0);
        } catch (e) {
            console.warn("Device fetch failed (non-blocking)");
        }

        // Helper: User Settings
        console.log("Fetching User Settings...");
        const userSettings = await gc.getUserSettings();


        // 3. Activities
        console.log("Fetching Activities...");
        let activities = [];
        try {
            const actData = await garminFetch({
                client: gc.client,
                url: 'https://connect.garmin.com/modern/proxy/activitylist-service/activities/search/activities',
                featureName: 'activities',
                params: { limit: 20, start: 0 }
            });
            if (Array.isArray(actData)) {
                activities = actData;
            } else {
                console.warn("Activities response was not an array", typeof actData);
            }
        } catch (e) { console.error("Activities fetch failed", e); }


        // --- ROBUST FETCHING HELPER ---
        const fetchWithFallback = async (featureName: string, urlBuilder: (date: string) => string, dates: string[]) => {
            let lastError = null;
            for (const d of dates) {
                try {
                    console.log(`[RAW FETCH] ${featureName} @ ${d}`);
                    const data = await garminFetch({
                        client: gc.client,
                        url: urlBuilder(d),
                        featureName,
                        params: { date: d }
                    });

                    // Raw logging per user request (Step 1)
                    if (process.env.GARMIN_DEBUG === '1') {
                        console.log(`RAW RESPONSE (${featureName}):`, JSON.stringify(data).slice(0, 500));
                    }

                    const isArray = Array.isArray(data);
                    // Some endpoints return array, others object. Checks logic:
                    const isValid = data && (isArray || Object.keys(data).length > 0);

                    if (isValid) {
                        return { status: 'available', date: d, data: data };
                    } else {
                        console.log(`[EMPTY] ${featureName} @ ${d} returned empty.`);
                    }
                } catch (e: any) {
                    lastError = e;
                    console.error(`[FAIL] ${featureName} @ ${d}: ${e.message}`);
                }
            }
            return {
                status: 'error',
                error: lastError ? lastError.message : 'No data found',
                data: null
            };
        };

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

        const fallbackDates = [todayStr, yesterdayStr, twoDaysAgoStr];


        // 4. WELLNESS (& Specific Endpoints)

        // Sleep
        const sleepResult = await fetchWithFallback(
            'dailyWellness.sleep',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailySleepData/${userId}`,
            fallbackDates
        );

        // Body Battery (Try correct endpoint variants)
        // Usually: /wellness-service/wellness/bodyBattery/daily/{userId}
        const bbResult = await fetchWithFallback(
            'dailyWellness.bodyBattery',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/bodyBattery/daily/${userId}`,
            [todayStr, yesterdayStr]
        );

        // Stress
        const stressResult = await fetchWithFallback(
            'dailyWellness.stress',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyStress/${userId}`,
            [todayStr, yesterdayStr]
        );

        // HRV
        // Note: HRV sometimes is strict on date.
        const hrvResult = await fetchWithFallback(
            'dailyWellness.hrv',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/hrv/daily/${userId}`,
            fallbackDates
        );

        // Heart Rate
        const heartRateResult = await fetchWithFallback(
            'dailyWellness.heartRate',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyHeartRate/${userId}`,
            [todayStr]
        );

        // Daily Summary
        const summaryResult = await fetchWithFallback(
            'dailyWellness.summary',
            (d) => `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userId}`,
            [todayStr, yesterdayStr]
        );


        // --- RESPONSE ASSEMBLY ---
        const responseData = {
            success: true,
            timestamp: new Date().toISOString(),
            debug_info: process.env.GARMIN_DEBUG === '1' ? {
                generated_at: new Date().toISOString(),
                user_id: userId,
                device_check: 'done'
            } : undefined,
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
                // Return result objects directly as Step 5 requested wrapper objects?
                // Frontend expects { data: ... } inside mostly if we don't break types.
                // garmin-utils checks: 'status' === 'available'.
                // So returning the full result object matches the `status` requirement.
                sleep: sleepResult,
                bodyBattery: bbResult,
                stress: stressResult,
                hrv: hrvResult
            },
            lifestyle: {
                summary: summaryResult.data
            }
        };

        // Cache Save
        if (USE_CACHE) {
            let fullCache: any = {};
            try { if (fs.existsSync(cacheFile)) fullCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) { }

            fullCache[`${cacheUserKey}-${todayStr}`] = {
                timestamp: Date.now(),
                data: responseData
            };
            try { fs.writeFileSync(cacheFile, JSON.stringify(fullCache, null, 2)); } catch (e) { }
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({
            error: 'Garmin Connection Error',
            details: error.message,
        }, { status: 500 });
    }
}
