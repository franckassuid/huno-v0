
import { NextResponse } from 'next/server';
import { getAuthenticatedGarminClient } from '@/lib/garmin-client';
import { garminFetch } from '@/lib/garmin-fetch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Default to today/yesterday if not provided
        const extractParam = (name: string) => searchParams.get(name) || undefined;

        const email = extractParam('email');
        const password = extractParam('password');

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 6);
        const lastWeekStr = lastWeek.toISOString().split('T')[0];

        console.log(`[DISCOVERY] Starting Matrix Test...`);

        // 1. Auth & IDs (Pass explicit creds if provided in URL)
        const gc = await getAuthenticatedGarminClient(email, password);
        const profile = await gc.getUserProfile();

        const ids = {
            profileId: profile.profileId, // Numeric
            displayName: profile.displayName, // String (often same as garminGUID in newer accounts)
            garminGUID: profile.garminGUID // UUID
        };

        // 2. Define Matrix
        const matrixRequest = [
            { metric: 'bodyBattery', endpoint: '/wellness-service/wellness/bodyBattery/daily', type: 'daily' },
            { metric: 'stress', endpoint: '/wellness-service/wellness/dailyStress', type: 'daily' },
            { metric: 'hrv', endpoint: '/wellness-service/wellness/hrv/daily', type: 'daily' },
            { metric: 'heartRate', endpoint: '/wellness-service/wellness/dailyHeartRate', type: 'daily' }
        ];

        const BASE_URL = 'https://connect.garmin.com/modern/proxy';

        const results: any[] = [];

        // 3. Execute Matrix in Batches (to avoid Vercel 10s timeout)
        // We have ~12-24 combinations. Serial = too slow.

        const tasks: (() => Promise<void>)[] = [];

        for (const item of matrixRequest) {
            for (const [idType, idValue] of Object.entries(ids)) {
                if (!idValue) continue;
                // Add variants
                tasks.push(() => runTest(results, gc.client, item, idType, idValue, todayStr, 'today'));
                tasks.push(() => runTest(results, gc.client, item, idType, idValue, yesterdayStr, 'yesterday'));
            }
        }

        console.log(`[DISCOVERY] Queued ${tasks.length} tasks. Executing in batches...`);

        // Execute in chunks of 5
        const CHUNK_SIZE = 5;
        for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
            const chunk = tasks.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(task => task()));
        }

        return NextResponse.json({
            meta: {
                timestamp: new Date().toISOString(),
                ids_used: ids,
                dates: { today: todayStr, yesterday: yesterdayStr }
            },
            results
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({
            error: 'Discovery Failed',
            details: error.message
        }, { status: 500 });
    }
}

async function runTest(results: any[], client: any, item: any, idType: string, id: string | number, dateParam: string, label: string) {
    const fullUrl = `https://connect.garmin.com/modern/proxy${item.endpoint}/${id}`;
    const featureName = `${item.metric}_${idType}_${label}`;

    console.log(`[DISCOVERY] Testing ${featureName}...`);

    try {
        const start = Date.now();
        let data: any;
        let status = 0;
        let headers: any = {};
        let rawBody = "";

        // Using direct axios client to bypass wrapper normalization for debug purity, 
        // OR use garminFetch but capturing all errors.
        // Let's use garminFetch to leverage the logging we built, but capture everything.

        try {
            data = await garminFetch({
                client,
                url: fullUrl,
                featureName: `discovery.${featureName}`,
                params: { date: dateParam }
            });
            status = 200; // if valid return
        } catch (e: any) {
            status = e.response?.status || 500;
            data = e.response?.data;
            headers = e.response?.headers;
        }

        const duration = Date.now() - start;
        const dataStr = data ? JSON.stringify(data) : "";
        const size = dataStr.length;

        results.push({
            name: item.metric,
            scenario: `${idType} + ${label}`,
            timestamp: new Date().toISOString(),
            endpointFullUrl: `${fullUrl}?date=${dateParam}`,
            usedUserId: id,
            idType: idType,
            rangeAsked: dateParam,
            statusHttp: status,
            responseContentType: headers?.['content-type'] || 'N/A',
            size: size,
            rawBodyFirst500: dataStr.slice(0, 500),
            parsedKeys: (data && typeof data === 'object') ? Object.keys(data) : [],
            durationMs: duration,
            isSuccess: status === 200 && size > 2 && dataStr !== "{}"
        });

    } catch (e: any) {
        results.push({
            name: item.metric,
            scenario: `${idType} + ${label}`,
            error: e.message
        });
    }
}
