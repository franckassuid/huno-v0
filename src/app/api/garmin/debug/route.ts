
import { NextResponse } from 'next/server';
import { getAuthenticatedGarminClient } from '@/lib/garmin-client';
import { garminFetch } from '@/lib/garmin-fetch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const raw = searchParams.get('raw') === 'true';

        console.log(`[DEBUG ENDPOINT] Starting diagnostics for date: ${date}`);

        // 1. Initialize Client (Unified Logic)
        const gc = await getAuthenticatedGarminClient();
        const profile = await gc.getUserProfile();
        // Use profileId numeric if available, else displayName (but profileId is safer for wellness)
        const userId = profile.profileId || profile.displayName;

        console.log(`[DEBUG ENDPOINT] Authenticated as: ${profile.fullName} (${userId})`);

        // 2. Define Endpoints to Test
        const endpoints = {
            dailySummary: `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userId}`,
            sleep: `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailySleepData/${userId}`,
            hrv: `https://connect.garmin.com/modern/proxy/wellness-service/wellness/hrv/daily/${userId}`,
            stress: `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyStress/${userId}`,
            bodyBattery: `https://connect.garmin.com/modern/proxy/wellness-service/wellness/bodyBattery/daily/${userId}`,
            heartRate: `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyHeartRate/${userId}`,
        };

        const results: any = {
            meta: {
                date,
                userId,
                timestamp: new Date().toISOString(),
                runtime: process.env.NEXT_RUNTIME || 'node',
                proxy: !!process.env.PROXY_URL
            },
            endpoints: {}
        };

        // 3. Sequential Fetching
        for (const [key, url] of Object.entries(endpoints)) {
            try {
                // Determine correct date param key (usually just 'date')
                // Sleep sometimes handles simple date param, others too.
                const params = { date };

                // Hack: HRV endpoint sometimes wants different params or range? 
                // Using standard daily pattern for now.

                console.log(`[DEBUG ENDPOINT] Fetching ${key}...`);
                const start = Date.now();

                let responseData: any = null;
                let status = 200; // default if throws
                let error = null;

                try {
                    responseData = await garminFetch({
                        client: gc.client,
                        url,
                        featureName: `debug.${key}`,
                        params
                    });
                } catch (e: any) {
                    error = e.message;
                    status = e.response?.status || 500;
                }

                const duration = Date.now() - start;

                // Inspect Payload
                const isEmpty = !responseData || (typeof responseData === 'object' && Object.keys(responseData).length === 0);
                const isHtml = typeof responseData === 'string' && responseData.trim().startsWith('<');

                results.endpoints[key] = {
                    status,
                    ok: !error && !isEmpty && !isHtml,
                    durationMs: duration,
                    size: responseData ? JSON.stringify(responseData).length : 0,
                    isEmpty,
                    isHtml,
                    error: error,
                    sample: raw ? responseData : (responseData ? JSON.stringify(responseData).slice(0, 500) + '...' : null)
                };

            } catch (loopErr) {
                results.endpoints[key] = { status: 500, error: 'Loop Error' };
            }
        }

        return NextResponse.json(results, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({
            error: 'Debug Scenario Failed',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
