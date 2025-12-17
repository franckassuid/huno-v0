export interface GarminData {
    profile: any;
    cardio: {
        vo2Max?: { vo2MaxPrecise: number }[];
        heartRate?: any;
        activities?: any[];
        fitnessAge?: any;
    };
    sleep?: {
        dailySleepDTO?: any;
    };
    wellness?: {
        bodyBattery?: any;
        stress?: any;
        hrv?: any;
        sleep?: any;
    };
    lifestyle?: {
        summary?: any;
    };
    devices?: any[];
    history?: any[];
    activities?: any[]; // Added from python
}

export interface HunoProfile {
    userId: number | null;
    garminIds: {
        id: number | null;
        profileId: number | null;
        garminGUID: string | null;
    };
    identity: {
        fullName: string | null;
        userName: string | null;
        location: string | null;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        bmi: number | null;
        profileImageUrl: string | null;
    };
    garminMeta: {
        userLevel: number | null;
        userPoints: number | null;
        nextLevelThreshold: number | null;
    };
    cardioStatus: {
        vo2Max: number | null;
        restingHrToday: number | null;
        restingHr7dAvg: number | null;
        minHrToday: number | null;
        maxHrToday: number | null;
        hrDate: string | null;
        hasContinuousHrData: boolean;
        heartRateValues: [number, number | null][];
    };
    wellnessStatus: {
        stress: any | null;
        bodyBattery: any | null;
        hrv: any | null;
        sleep: {
            totalSleepSeconds: number | null;
            deepSleepSeconds: number | null;
            lightSleepSeconds: number | null;
            remSleepSeconds: number | null;
        };
        // History (7-28 days)
        hrvHistory: { date: string; value: number | null }[];
        stressHistory: { date: string; value: number | null }[];
        bodyBatteryHistory: { date: string; max: number | null; min: number | null }[];
    };
    lifestyleStatus: {
        steps: number | null;
        stepsYesterday: number | null;
        stepsGoal: number | null;
        activeCalories: number | null;
        totalCalories: number | null;
    };
    recentActivities: ActivitySummary[];
    dataFreshness: {
        profileLastUpdated: string | null;
        lastHrDate: string | null;
        lastActivityDate: string | null;
    };
    dailySummary: {
        steps: number | null;
        stepsGoal: number | null;
        activeCalories: number | null;
        totalCalories: number | null;
    } | null;
    devices: any[];
}

export interface ActivitySummary {
    activityId: number;
    name: string;
    sport: string | null;
    startTimeLocal: string;
    startTimeGMT: string;
    durationSec: number;
    distanceM: number | null;
    calories: number | null;
    averageHR: number | null;
    maxHR: number | null;
    trainingLoad: number | null;
    aerobicTE: number | null;
    anaerobicTE: number | null;
    moderateMinutes: number | null;
    vigorousMinutes: number | null;
}

export interface HunoSchema {
    metadata: {
        schema_version: string;
        generated_at: string;
        source: string;
    };
    identity: {
        fullName: string | null;
        sex: string | null;
        age: number | null;
        height_cm: number | null;
        weight_kg: number | null;
        location: string | null;
    };
    cardioStatus: {
        vo2max: number | null;
        resting_hr: number | null;
        hr_min: number | null;
        hr_max: number | null;
        hr_7day_avg_rest: number | null;
    };
    wellnessStatus: {
        sleep_available: boolean;
        stress_available: boolean;
        hrv_available: boolean;
        history?: {
            hrv: any[];
            stress: any[];
            body_battery: any[];
        };
    };
    recentActivities: {
        swims: any[];
        dives: any[];
    };
    onboarding: any;
}
