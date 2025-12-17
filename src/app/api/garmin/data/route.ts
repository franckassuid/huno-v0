import { NextResponse } from 'next/server';
import { fetchGarminDataFromPython } from '@/services/garmin/api';
import { buildHunoProfile } from '@/services/garmin/transformer';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        console.log("[API] Fetching Garmin data...");
        const rawJson = await fetchGarminDataFromPython(email, password);

        // DEBUG: Write raw JSON to file
        try {
            const debugPath = path.join(process.cwd(), 'garmin-raw-debug.json');
            fs.writeFileSync(debugPath, JSON.stringify(rawJson, null, 2));
            console.log("[API] Saved raw debug data to", debugPath);
        } catch (e) {
            console.error("Failed to save debug file", e);
        }

        // Transform the messy Python output into our clean Domain Model
        const hunoProfile = buildHunoProfile(rawJson);

        return NextResponse.json(hunoProfile);

    } catch (error: any) {
        console.error("[API] Error:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
