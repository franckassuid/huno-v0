import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

import fs from 'fs';

// Helper to calculate age
const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

// Force dynamic to prevent static optimization issues with spawning processes
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    console.log("[API] /api/garmin/data - Received request");

    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            console.error("[API] Missing credentials");
            return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
        }

        // Locate the python script
        const scriptPath = path.join(process.cwd(), 'python', 'fetch_data.py');
        console.log(`[API] Spawning python script at: ${scriptPath}`);

        // Spawn python process
        // We assume 'python3' is in the PATH. 
        const pythonProcess = spawn('python3', [scriptPath, email, password]);

        let dataString = '';
        let errorString = '';

        const exitCode = await new Promise<number>((resolve) => {
            pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                // console.log(`[PYTHON STDOUT] ${chunk.slice(0, 50)}...`); // Log start of chunk
                dataString += chunk;
            });

            pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                console.error(`[PYTHON STDERR] ${chunk}`);
                errorString += chunk;
            });

            pythonProcess.on('close', (code) => {
                console.log(`[PYTHON EXIT] Code: ${code}`);
                resolve(code ?? 0);
            });

            pythonProcess.on('error', (err) => {
                console.error(`[PYTHON SPAWN ERROR] ${err.message}`);
                errorString += err.message;
                resolve(1);
            });
        });

        if (exitCode !== 0) {
            console.error("Python script returned non-zero exit code");
            return NextResponse.json({
                success: false,
                error: 'Python script execution failed',
                details: errorString,
                code: exitCode
            }, { status: 500 });
        }

        try {
            // Trim whitespace/newlines
            const cleanData = dataString.trim();
            // console.log("[API] Parsing JSON response of length:", cleanData.length);

            if (!cleanData) {
                throw new Error("Empty output from Python script");
            }

            const jsonResponse = JSON.parse(cleanData);

            // DEBUG: Write raw python response to file
            try {
                const debugPath = path.join(process.cwd(), 'garmin-debug-py.json');
                fs.writeFileSync(debugPath, JSON.stringify(jsonResponse, null, 2));
                console.log(`[API] Wrote raw debug data to: ${debugPath}`);
            } catch (err) {
                console.error("[API] Failed to write debug file:", err);
            }

            // Check for explicit error from Python script
            if (jsonResponse.success === false) {
                console.error("[API] Python script reported error:", jsonResponse.error);
                return NextResponse.json({
                    success: false,
                    error: jsonResponse.error || 'Unknown error',
                    details: jsonResponse
                }, { status: 401 }); // Using 401 as it's likely auth related, but could be dynamic
            }

            // --- DATA MAPPING ---

            // Merge profile and settings
            // garmin-utils expects weight/height in the 'profile' object.

            // Fix: In Python script, 'profile' key holds the result of get_user_profile(), which contains 'userData'
            const userData = jsonResponse.profile?.userData || {};
            const userIdentity = jsonResponse.identity || {};

            // garmin-utils expects: fullName, userName (displayName), etc.
            const combinedProfile = {
                ...jsonResponse.profile, // contains id, userData, etc
                ...userData,             // Flatten userData (weight, height, birthDate) to top level for utility
                fullName: userIdentity.fullName,
                userName: userIdentity.displayName,
                // Ensure age is populated if birthDate is available
                age: userData.age || calculateAge(userData.birthDate)
            };

            // Heart Rate Mapping (Ensure CamelCase)
            // Python/Garmin usually returns: restingHeartRate, minHeartRate, maxHeartRate, heartRateValues
            const hrData = jsonResponse.wellness?.heart_rate || {};

            // Helper to unwrap array if needed (some endpoints return [data] instead of data)
            const unwrap = (val: any) => Array.isArray(val) && val.length > 0 ? val[0] : val;

            const sleepData = jsonResponse.wellness?.sleep; // Sleep seems directly an object in debug
            const stepsData = jsonResponse.wellness?.steps; // Steps seems to be array of blocks
            const stepsYesterdayData = jsonResponse.wellness?.steps_yesterday; // From python
            const stressData = jsonResponse.wellness?.stress;
            const bbData = jsonResponse.wellness?.body_battery;

            // Transform to GarminData structure expected by frontend (garmin-utils.ts)
            // Note: Frontend mostly expects "wellness.stress.data" to be the array of values or the summary object
            const mappedResponse = {
                profile: combinedProfile,
                cardio: {
                    vo2Max: combinedProfile.vo2MaxPrecise ? [{ vo2MaxPrecise: combinedProfile.vo2MaxPrecise }] : [],
                    heartRate: {
                        restingHeartRate: hrData.restingHeartRate,
                        minHeartRate: hrData.minHeartRate,
                        maxHeartRate: hrData.maxHeartRate,
                        // Fix for Graph: heartRateValues comes as [[ts, val], ...]
                        heartRateValues: hrData.heartRateValues,
                        calendarDate: hrData.calendarDate
                    },
                    activities: jsonResponse.activities,
                    fitnessAge: combinedProfile.fitnessAge
                },
                wellness: {
                    sleep: {
                        // Sleep in debug is an object { userSleep: {...}, userSleepWindows: [...] } or null
                        // garmin-utils expects { dailySleepDTO: { ... } } style usually
                        status: sleepData ? 'available' : 'unavailable',
                        data: {
                            dailySleepDTO: {
                                sleepTimeSeconds: sleepData?.userSleep?.sleepTime || null,
                                deepSleepSeconds: sleepData?.dailySleepDTO?.deepSleepSeconds || 0, // Fallback if regular DTO missing
                                lightSleepSeconds: sleepData?.dailySleepDTO?.lightSleepSeconds || 0,
                                remSleepSeconds: sleepData?.dailySleepDTO?.remSleepSeconds || 0
                            }
                        }
                    },
                    stress: {
                        status: stressData ? 'available' : 'unavailable',
                        data: stressData // Pass raw
                    },
                    bodyBattery: {
                        status: bbData ? 'available' : 'unavailable',
                        data: bbData // Pass raw (likely array)
                    },
                    hrv: { status: 'unavailable', data: null }
                },
                devices: jsonResponse.devices || [],
                history: jsonResponse.history || [],
                lifestyle: {
                    // Steps in debug is an array of 15-min buckets.
                    // We need to calculate total steps from this array for "summary"
                    summary: {
                        steps: Array.isArray(stepsData)
                            ? stepsData.reduce((acc: number, curr: any) => acc + (curr.steps || 0), 0)
                            : 0,
                        stepsYesterday: Array.isArray(stepsYesterdayData)
                            ? stepsYesterdayData.reduce((acc: number, curr: any) => acc + (curr.steps || 0), 0)
                            : 0
                    }
                }
            };

            return NextResponse.json(mappedResponse);

        } catch (e: any) {
            console.error("JSON Parse Error:", e.message);
            console.log("Raw Output:", dataString);
            return NextResponse.json({
                success: false,
                error: 'Invalid JSON from Python script',
                raw: dataString.slice(0, 500) + '...', // Truncate for safety
                parseError: e.message
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("[API] Unhandled Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
