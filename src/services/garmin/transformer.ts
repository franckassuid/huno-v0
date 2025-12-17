import { GarminData, HunoProfile, HunoSchema, ActivitySummary } from '../../domain/types';

export function buildHunoProfile(garminData: any): HunoProfile {
    // 1. EXTRACTION FROM PYTHON OUTPUT
    const p = garminData.profile || {};
    const activities = Array.isArray(garminData.activities) ? garminData.activities : [];
    const wellness = garminData.wellness || {};

    // 2. KEYS DEFINITION (Based on debug JSON)
    // - Wellness keys are snake_case from python dict
    const stepsData = wellness.steps || {};
    const hrData = wellness.heart_rate || {};
    const sleepData = wellness.sleep || {};
    const stressData = wellness.stress || {};

    // - Body Battery structure is an array of objects for history, but Python script puts today's object in a list?
    // Based on debug JSON: wellness.body_battery is an Array: [{ date: "...", bodyBatteryValuesArray: [...] }]
    const bbRoot = Array.isArray(wellness.body_battery) ? wellness.body_battery[0] : (wellness.body_battery || {});

    // 3. IDENTITY
    const userData = p.userData || {};
    const weightKg = userData.weight ? userData.weight / 1000 : (p.weight ? p.weight / 1000 : null);
    const heightCm = userData.height ? userData.height : (p.height ? p.height : null);
    const heightM = heightCm ? heightCm / 100 : null;
    const bmi = (weightKg && heightM) ? Number((weightKg / (heightM * heightM)).toFixed(2)) : null;

    const lastActivity = activities[0] || null;

    // 4. DATA MAPPING
    // Stress: 'dailyStress' -> 'stressValuesArray': [[ts, lvl], ...]
    const stressValues = Array.isArray(stressData.stressValuesArray)
        ? stressData.stressValuesArray
            .filter((x: any) => x && x[1] !== null && x[1] >= 0)
            .map((x: any) => ({ x: x[0], y: x[1] }))
        : [];

    // Body Battery: 'dailyBodyBattery' -> 'bodyBatteryValuesArray': [[ts, status(?), level, ...], ...]
    const bbValues = Array.isArray(bbRoot.bodyBatteryValuesArray)
        ? bbRoot.bodyBatteryValuesArray
            .filter((x: any) => x && x[1] !== null)
            .map((x: any) => ({ date: x[0], val: x[1] }))
        : [];

    const cleanBBValues = bbValues; // Already filtered

    // Sleep: 'dailySleepData' -> 'dailySleepDTO'
    // Debug JSON shows wellness.sleep is { dailySleepDTO: { ... } }
    const sleepDTO = sleepData.dailySleepDTO || {};

    // Heart Rate: 'dailyHeartRate' -> 'heartRateValues': [[ts, val], ...]
    const hrValues = Array.isArray(hrData.heartRateValues)
        ? hrData.heartRateValues.map((x: any) => [x[0], x[1]])
        : [];

    // Steps: 'dailySteps' -> totalSteps
    // Debug JSON shows wellness.steps is ARRAY of step data? No, usually object for 'today'.
    // Let's check: step data structure in Python is often list of steps or summary?
    // Debug JSON: 
    // "steps": [ { "startGMT": "...", "steps": 0, ... } ] (Array of chunks?)
    // OR just an object?
    // Python script uses `garmin.get_steps_data(today_str)`. This usually returns an Array of step counts per 15min block.
    // To get TOTAL steps, we should use the User Summary or sum these up.
    // Python script ALSO returns `history` array. The first element is today's summary!
    // Let's look at `garminData.history[0].stats.totalSteps`.

    const todayStats = (garminData.history && garminData.history[0]) ? garminData.history[0].stats : {};
    const stepsTotal = todayStats.totalSteps || 0;
    const stepsGoal = todayStats.dailyStepGoal || 0;
    const activeCals = todayStats.activeKilocalories || 0;
    const totalCals = todayStats.totalKilocalories || 0;

    // 5. HISTORY MAPPING
    const history = Array.isArray(garminData.history) ? garminData.history : [];

    // HRV
    // Structure: day.hrv might be null. If present, it has hrvSummary or similar. 
    // We'll try to get 'lastNightAvg' or 'weeklyAverage'
    const hrvHistory = history.map((h: any) => {
        const val = h.hrv?.hrvSummary?.lastNightAvg || null;
        return { date: h.date, value: val };
    }).filter((h: { value: any }) => h.value !== null).reverse(); // Oldest first or newest first? Charts usually want time ascending.
    // Python history is Descending (today, yesterday...) because we iterate range_28d (today...today-28).
    // range generates DESCENDING dates? No: [today, today-1...]. So index 0 is today.
    // We want ascending for graphs.
    hrvHistory.reverse();

    // Stress History
    const stressHistory = history.map((h: any) => ({
        date: h.date,
        value: h.stats.averageStressLevel ?? null
    })).filter((h: { value: any }) => h.value !== null).reverse();

    // Body Battery History
    const bodyBatteryHistory = history.map((h: any) => ({
        date: h.date,
        max: h.stats.bodyBatteryHighestValue ?? null,
        min: h.stats.bodyBatteryLowestValue ?? null
    })).filter((h: { max: any }) => h.max !== null).reverse();


    return {
        userId: p.id ?? null,
        garminIds: {
            id: p.id ?? null,
            profileId: p.id ?? null,
            garminGUID: p.displayName ?? null // Users often user displayName as GUID
        },
        identity: {
            // Python API puts displayName/fullName in ROOT 'identity' object.
            fullName: garminData.identity?.fullName ?? p.fullName ?? null,
            userName: garminData.identity?.displayName ?? p.displayName ?? null,
            location: userData.weatherLocation?.locationName ?? null,
            age: calculateAge(userData.birthDate),
            heightCm,
            weightKg,
            bmi,
            profileImageUrl: p.profileImageUrlLarge ?? p.profileImageUrlMedium ?? null
        },
        garminMeta: {
            // These are gamification points, often not in standard profile
            userLevel: null,
            userPoints: null,
            nextLevelThreshold: null
        },
        cardioStatus: {
            vo2Max: userData.vo2MaxRunning || userData.vo2MaxCycling || null,
            restingHrToday: todayStats.restingHeartRate ?? hrData.restingHeartRate ?? null,
            restingHr7dAvg: todayStats.lastSevenDaysAvgRestingHeartRate ?? null,
            minHrToday: todayStats.minHeartRate ?? hrData.minHeartRate ?? null,
            maxHrToday: todayStats.maxHeartRate ?? hrData.maxHeartRate ?? null,
            hrDate: hrData.calendarDate ?? new Date().toISOString(),
            hasContinuousHrData: hrValues.length > 0,
            heartRateValues: hrValues
        },
        wellnessStatus: {
            stress: stressValues.length > 0 ? stressValues : null,
            bodyBattery: cleanBBValues.length > 0 ? cleanBBValues : null,
            hrv: hrvHistory.length > 0 ? hrvHistory : null,
            sleep: {
                totalSleepSeconds: sleepDTO.sleepTimeSeconds || 0,
                deepSleepSeconds: sleepDTO.deepSleepSeconds || 0,
                lightSleepSeconds: sleepDTO.lightSleepSeconds || 0,
                remSleepSeconds: sleepDTO.remSleepSeconds || 0
            },
            hrvHistory,
            stressHistory,
            bodyBatteryHistory
        },
        recentActivities: mapActivities(activities),
        lifestyleStatus: {
            steps: stepsTotal,
            stepsYesterday: null,
            stepsGoal: stepsGoal,
            activeCalories: activeCals,
            totalCalories: totalCals
        },
        dataFreshness: {
            profileLastUpdated: null,
            lastHrDate: hrData.calendarDate ?? null,
            lastActivityDate: lastActivity?.startTimeLocal ?? null
        },
        dailySummary: {
            steps: stepsTotal,
            stepsGoal: stepsGoal,
            activeCalories: activeCals,
            totalCalories: totalCals
        },
        devices: garminData.devices || []
    };
}

function calculateAge(birthDate: string): number | null {
    if (!birthDate) return null;
    const diff = Date.now() - new Date(birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function mapActivities(activities: any[]): ActivitySummary[] {
    return activities.map((a: any) => ({
        activityId: a.activityId,
        name: a.activityName,
        sport: a.activityType?.typeKey ?? null,
        startTimeLocal: a.startTimeLocal,
        startTimeGMT: a.startTimeGMT,
        durationSec: a.duration,
        distanceM: a.distance ?? null,
        calories: a.calories ?? null,
        averageHR: a.averageHR ?? null,
        maxHR: a.maxHR ?? null,
        trainingLoad: a.activityTrainingLoad ?? null,
        aerobicTE: a.aerobicTrainingEffect ?? null,
        anaerobicTE: a.anaerobicTrainingEffect ?? null,
        moderateMinutes: a.moderateIntensityMinutes ?? null,
        vigorousMinutes: a.vigorousIntensityMinutes ?? null
    }));
}

export function generateFinalJson(profile: HunoProfile, onboardingData: any, rawGarminActivities: any[] = []): HunoSchema {
    const p = profile.identity;
    const c = profile.cardioStatus;
    const w = profile.wellnessStatus;
    const o = onboardingData || {};

    return {
        metadata: {
            schema_version: "1.0.0",
            generated_at: new Date().toISOString(),
            source: "huno_app"
        },
        identity: {
            fullName: p.fullName,
            sex: o['sex'] || 'male',
            age: p.age,
            height_cm: p.heightCm,
            weight_kg: p.weightKg ? Number(p.weightKg.toFixed(2)) : null,
            location: p.location
        },
        cardioStatus: {
            vo2max: c.vo2Max,
            resting_hr: c.restingHrToday,
            hr_min: c.minHrToday,
            hr_max: c.maxHrToday,
            hr_7day_avg_rest: c.restingHr7dAvg
        },
        wellnessStatus: {
            sleep_available: !!(w.sleep && w.sleep.totalSleepSeconds),
            stress_available: !!(w.stress && w.stress.length > 0),
            hrv_available: !!(w.hrv && w.hrv.length > 0),
            history: {
                hrv: w.hrvHistory,
                stress: w.stressHistory,
                body_battery: w.bodyBatteryHistory
            }
        },
        recentActivities: {
            swims: (profile.recentActivities || []).filter((a: any) => a.sport === 'lap_swimming').map((a: any) => ({
                date: a.startTimeLocal,
                distance_m: a.distanceM || 0,
                duration_s: a.durationSec || 0,
                avg_hr: a.averageHR || null,
                training_load: a.trainingLoad || null
            })),
            dives: (profile.recentActivities || []).filter((a: any) => a.sport === 'single_gas_diving').map((a: any) => ({
                date: a.startTimeLocal,
                max_depth_m: (a as any).maxDepth || 0, // maxDepth might not be in summary yet but let's be safe
                bottom_time_s: a.durationSec || 0
            }))
        },
        onboarding: o
    };
}


