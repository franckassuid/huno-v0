import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { getAuthenticatedGarminClient } from '../src/lib/garmin-client.js';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runTest() {
    console.log("--- GARMIN API DEBUGGER (PURE AXIOS MODE) ---");

    // We still need email/password to initialize the library structure just to get UserID if needed 
    // (or we can skip it if we have ID manually, but let's keep it robust)
    const email = (process.env.GARMIN_EMAIL || '').trim();
    const password = (process.env.GARMIN_PASSWORD || '').trim();

    const cookiePath = path.join(process.cwd(), 'cookies.txt');
    let manualCookies = '';
    if (fs.existsSync(cookiePath)) {
        manualCookies = fs.readFileSync(cookiePath, 'utf8').trim();
        console.log("🍪 Loaded Manual Cookies from cookies.txt");
    } else {
        console.log("ℹ️ No cookies.txt found. PLEASE CREATE ONE for this test to work.");
        // If no cookies, pure axios will definitely fail on GC-API.
    }

    // Try to get UserID from env or fallback
    let userId = '588d7b34-e06b-4760-870f-72ae67f8531c'; // Default fallback from logs

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`📅 Date: ${today}`);

    const urls = [
        `https://connect.garmin.com/gc-api/wellness-service/wellness/dailyStress/${today}`,
        `https://connect.garmin.com/modern/proxy/wellness-service/wellness/dailyStress/${today}`,
        `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${userId}`
    ];

    for (const url of urls) {
        console.log(`\n🔗 Fetching (AXIOS PUR): ${url}`);
        try {
            const headers: any = {
                'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                'NK': 'NT',
                'Origin': 'https://connect.garmin.com',
                'Referer': 'https://connect.garmin.com/modern/',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            };

            if (manualCookies) {
                headers['Cookie'] = manualCookies;
                console.log("   (Injecting Manual Cookies)");
            }

            // Use PURE AXIOS (Bypassing garmin-connect lib interceptors)
            const res = await axios.get(url, {
                headers,
                validateStatus: () => true // Don't throw on 401/403/500 so we can see the body
            });

            console.log(`✅ Status: ${res.status} ${res.statusText}`);
            const dataKeys = Object.keys(res.data || {});

            if (res.status === 200) {
                if (dataKeys.length === 0) {
                    console.log("⚠️ EMPTY RESPONSE {}");
                } else {
                    console.log(`📦 Data Keys:`, dataKeys);
                    console.log(`📄 Snippet:`, JSON.stringify(res.data).slice(0, 300));
                }
            } else {
                console.log("❌ Error Body:", JSON.stringify(res.data).slice(0, 200));
            }

        } catch (e: any) {
            console.error(`❌ Fatal Fetch Error: ${e.message}`);
        }
    }
}

runTest();
