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
        // DEBUG TRACE STORAGE
        const debugTrace: any[] = [];

        // Helper for safe JSON stringify
        const safeStringify = (obj: any) => {
            try {
                const str = JSON.stringify(obj);
                return str ? str.slice(0, 500) : 'undefined';
            } catch (e) {
                return '[Circular/Unserializable]';
            }
        };

        // Update logDebug to be safer
        const logDebug = (label: string, details: any) => {
            try {
                console.log(`[DEBUG] ${label}`, safeStringify(details)); // Log safe version
                debugTrace.push({ time: new Date().toISOString(), label, details: safeStringify(details) });
            } catch (e) { console.error("Logger failed", e); }
        };


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
        // VERIFIED TRUTH: Use displayName (UUID) for these specific endpoints
        const userId = userProfile.displayName;

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
                        params: { calendarDate: d } // CHANGED: param name is 'calendarDate' for user-summary
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
        // const twoDaysAgo = new Date(today); // Removed as per new fallbackDates
        // twoDaysAgo.setDate(twoDaysAgo.getDate() - 2); // Removed as per new fallbackDates
        // const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0]; // Removed as per new fallbackDates

        const fallbackDates = [todayStr, yesterdayStr];


        // 4. WELLNESS (REVISED ENDPOINTS BASED ON TRUTH)
        // Verified Endpoint: /usersummary-service/usersummary/daily/{uuid}?calendarDate=...

        console.log("--- WELLNESS FETCHING (Verified Mode) ---");

        // The "usersummary/daily" endpoint actually contains ALL metrics in one go!
        // We should fetch it ONCE and dispatch the data.

        // --- 4. FETCH DATA (SKIPPED FOR DEBUG) ---
        console.log("SKIP FETCHING FOR DEBUG - TESTING AUTH ONLY");
        let dailySummaryData: any = {};

        /*
        let summaryRaw: any = { status: 'unavailable', data: null, date: '' };

        // ATTEMPT 1: Modern Proxy (UserSummary)
        summaryRaw = await fetchWithFallback(
            'dailySummary.Proxy',
            (d) => `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userId}`,
            fallbackDates
        );

        // ATTEMPT 2: Legacy Wellness Service (If Proxy Empty)
        // This is the "Classic" endpoint that might still be open
        if (summaryRaw.status !== 'available') {
            summaryRaw = await fetchWithFallback(
                'dailySummary.WellnessLegacy',
                // Note: 'date' param here, not calendarDate. And usually needs UUID.
                (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailySummary/${userId}?date=${d}`,
                fallbackDates
            );
        }

        // ATTEMPT 3: Numeric ID Proxy (Last Resort)
        if (summaryRaw.status !== 'available' && userProfile.profileId) {
            summaryRaw = await fetchWithFallback(
                'dailySummary.NumericProxy',
                (d) => `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userProfile.profileId}`,
                fallbackDates
            );
        }

        if (summaryRaw.status === 'available') {
            dailySummaryData = summaryRaw.data;
            logDebug('Summary Data Acquired', { source: 'Success', keys: Object.keys(dailySummaryData) });
        } else {
            logDebug('Summary Data Failed', { message: 'All 3 endpoints returned empty/error' });
        }
        */
        // 5. PARSE DATA FOR FRONTEND (Universal Parser)

        // --- SLEEP ---
        // Summary has total seconds. Detailed chart usually comes from a separate 'dailySleepData' endpoint.
        // If we only have summary, we'll show just the total score.
        const sleepResult = {
            status: (dailySummaryData.sleepingSeconds && dailySummaryData.sleepingSeconds > 0) ? 'available' : 'unavailable',
            data: {
                dailySleepDTO: {
                    sleepTimeSeconds: dailySummaryData.sleepingSeconds,
                    deepSleepSeconds: dailySummaryData.deepSleepSeconds || 0,
                    lightSleepSeconds: dailySummaryData.lightSleepSeconds || 0,
                    remSleepSeconds: dailySummaryData.remSleepSeconds || 0
                }
            }
        };

        // --- BODY BATTERY ---
        // Check if we have the explicit array from the "Detailed Summary" JSON
        // Structure based on User provided JSON: [timestamp, status, level, version]
        let bbData = null;
        if (dailySummaryData.bodyBatteryValuesArray) {
            // Map to format suitable for graph: [{ date: ts, val: level }, ...]
            bbData = dailySummaryData.bodyBatteryValuesArray.map((item: any[]) => ({
                date: item[0], // Timestamp
                val: item[2],  // Level
                // Extras
                status: item[1]
            }));
        } else if (dailySummaryData.bodyBatteryMostRecentValue !== undefined) {
            // Fallback to single point if array missing
            bbData = [{
                date: new Date().getTime(),
                val: dailySummaryData.bodyBatteryMostRecentValue,
                charged: dailySummaryData.bodyBatteryChargedValue,
                drained: dailySummaryData.bodyBatteryDrainedValue
            }];
        }

        const bbResult = {
            status: bbData ? 'available' : 'unavailable',
            data: bbData
        };

        // --- STRESS ---
        // Structure: [timestamp, level]
        let stressData = null;
        if (dailySummaryData.stressValuesArray) {
            stressData = dailySummaryData.stressValuesArray.map((item: any[]) => ({
                x: item[0], // Timestamp
                y: item[1]  // Level
            }));
        } else if (dailySummaryData.averageStressLevel !== undefined) {
            stressData = {
                avgStressLevel: dailySummaryData.averageStressLevel,
                maxStressLevel: dailySummaryData.maxStressLevel,
                stressDuration: dailySummaryData.stressDuration,
                stressQualifier: dailySummaryData.stressQualifier
            };
        }

        const stressResult = {
            status: stressData ? 'available' : 'unavailable',
            data: stressData
        };

        // --- HRV ---
        const hrvResult = {
            status: 'unavailable',
            data: null
        };

        // --- HEART RATE ---
        // If we lost the graph (Activities Fetch blocked?), try to use min/max/resting from summary
        // The detailed HR graph is usually fetched from /wellness-service/wellness/dailyHeartRate/{uuid}
        // We will keep `heartRateResult.data` from the specific fetch we did earlier.

        // Heart Rate is usually separate (chart data).
        // We stick to the old endpoint for detailed HR chart, or use summary resting HR.
        const heartRateResult = await fetchWithFallback(
            'dailyWellness.heartRate',
            (d) => `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyHeartRate/${userId}`,
            [todayStr]
        ); // This one might still fail if not updated, but let's keep it 'best effort'.

        // Enhance Cardio
        const cardioData = {
            vo2Max: dailySummaryData.vo2MaxPrecise || null,
            fitnessAge: dailySummaryData.fitnessAge || null,
            restingHrToday: dailySummaryData.restingHeartRate,
            minHrToday: dailySummaryData.minHeartRate,
            maxHrToday: dailySummaryData.maxHeartRate,
            heartRateValues: heartRateResult.data // Keep the detailed chart if it worked
        };




        // --- RESPONSE ASSEMBLY ---
        const responseData = {
            success: true,
            timestamp: new Date().toISOString(),
            _debug_trace: debugTrace,
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
                ...cardioData,
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
                summary: dailySummaryData
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
        console.log("CRITICAL ERROR CAUGHT");
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({
            error: 'Garmin Connection Error',
            details: error.message,
        }, { status: 500 });
    }
}
