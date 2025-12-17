import { HunoProfile } from '../domain/types';

export const MOCK_PROFILE: HunoProfile = {
    userId: 999999,
    garminIds: {
        id: 999999,
        profileId: 999999,
        garminGUID: "demo-user-guid"
    },
    identity: {
        fullName: "Utilisateur Démo",
        userName: "demo_user",
        location: "Paris, France",
        age: 30,
        heightCm: 180,
        weightKg: 75,
        bmi: 23.1,
        profileImageUrl: null
    },
    garminMeta: {
        userLevel: 3,
        userPoints: 1250,
        nextLevelThreshold: 1500
    },
    cardioStatus: {
        vo2Max: 48,
        restingHrToday: 55,
        restingHr7dAvg: 56,
        minHrToday: 52,
        maxHrToday: 175,
        hrDate: new Date().toISOString(),
        hasContinuousHrData: true,
        heartRateValues: Array.from({ length: 48 }, (_, i) => [
            Date.now() - (48 - i) * 30 * 60 * 1000,
            55 + Math.floor(Math.random() * 40)
        ])
    },
    wellnessStatus: {
        stress: Array.from({ length: 24 }, (_, i) => ({
            x: Date.now() - (24 - i) * 60 * 60 * 1000,
            y: 15 + Math.floor(Math.random() * 40)
        })),
        bodyBattery: Array.from({ length: 24 }, (_, i) => ({
            date: Date.now() - (24 - i) * 60 * 60 * 1000,
            val: Math.max(0, 100 - i * 4 + Math.floor(Math.random() * 10))
        })),
        hrv: null,
        sleep: {
            totalSleepSeconds: 27900, // 7h45
            deepSleepSeconds: 5400, // 1h30
            lightSleepSeconds: 18000, // 5h
            remSleepSeconds: 4500 // 1h15
        },
        hrvHistory: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: 45 + Math.floor(Math.random() * 10)
        })),
        stressHistory: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: 25 + Math.floor(Math.random() * 15)
        })),
        bodyBatteryHistory: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            max: 90 + Math.floor(Math.random() * 10),
            min: 15 + Math.floor(Math.random() * 10)
        })),
    },
    lifestyleStatus: {
        steps: 8542,
        stepsYesterday: 10234,
        stepsGoal: 10000,
        activeCalories: 450,
        totalCalories: 2450
    },
    recentActivities: [
        {
            activityId: 101,
            name: "Course à pied matinale",
            sport: "running",
            startTimeLocal: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
            startTimeGMT: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            durationSec: 1800,
            distanceM: 5000,
            calories: 350,
            averageHR: 145,
            maxHR: 170,
            trainingLoad: 80,
            aerobicTE: 3.2,
            anaerobicTE: 0.5,
            moderateMinutes: 10,
            vigorousMinutes: 20
        },
        {
            activityId: 102,
            name: "Natation",
            sport: "lap_swimming",
            startTimeLocal: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            startTimeGMT: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
            durationSec: 2400,
            distanceM: 1500,
            calories: 400,
            averageHR: 130,
            maxHR: 150,
            trainingLoad: 60,
            aerobicTE: 2.5,
            anaerobicTE: 0.0,
            moderateMinutes: 40,
            vigorousMinutes: 0
        }
    ],
    dataFreshness: {
        profileLastUpdated: new Date().toISOString(),
        lastHrDate: new Date().toISOString(),
        lastActivityDate: new Date().toISOString()
    },
    dailySummary: {
        steps: 8542,
        stepsGoal: 10000,
        activeCalories: 450,
        totalCalories: 2450
    },
    devices: [
        {
            productDisplayName: "Fenix 7",
            wifiConnected: true,
            partNumber: "006-B1234-00"
        }
    ]
};
