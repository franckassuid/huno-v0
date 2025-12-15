
// --- INTERFACES: GARMIN (Source) ---

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
}

// --- INTERFACES: HUNO PROFILE (Destination) ---

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
        heartRateValues: [number, number | null][]; // timestamp, value
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
    };
    recentActivities: {
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
    }[];
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
}

// --- HELPER FUNCTIONS ---

export function buildHunoProfile(garminData: GarminData): HunoProfile {
    const p = garminData.profile || {};
    const cardio = garminData.cardio || {};
    const hr = cardio.heartRate || {};
    const vo2 = cardio.vo2Max?.[0] || null;
    const activities = Array.isArray(cardio.activities) ? cardio.activities : [];
    const sleepDTO = garminData.sleep?.dailySleepDTO || {};
    const wellness = garminData.wellness || {};
    const lifestyle = garminData.lifestyle?.summary || {};

    // Weight is in grams in Garmin data
    const weightKg = typeof p.weight === "number" ? p.weight / 1000 : null;
    const heightCm = typeof p.height === "number" ? p.height : null;
    const heightM = heightCm ? heightCm / 100 : null;

    const bmi =
        weightKg && heightM
            ? Number((weightKg / (heightM * heightM)).toFixed(2))
            : null;

    const lastActivity = activities[0] || null;

    return {
        userId: p.profileId ?? null,
        garminIds: {
            id: p.id ?? null,
            profileId: p.profileId ?? null,
            garminGUID: p.garminGUID ?? null
        },
        identity: {
            fullName: p.fullName ?? null,
            userName: p.userName ?? null,
            location: p.location ?? null,
            age: p.age ?? null,
            heightCm,
            weightKg,
            bmi
        },
        garminMeta: {
            userLevel: p.userLevel ?? null,
            userPoints: p.userPoint ?? null,
            nextLevelThreshold: p.levelPointThreshold ?? null
        },
        cardioStatus: {
            vo2Max: vo2?.vo2MaxPrecise ?? null,
            restingHrToday: hr.restingHeartRate ?? null,
            restingHr7dAvg: hr.lastSevenDaysAvgRestingHeartRate ?? null,
            minHrToday: hr.minHeartRate ?? null,
            maxHrToday: hr.maxHeartRate ?? null,
            hrDate: hr.calendarDate ?? null,
            hasContinuousHrData:
                Array.isArray(hr.heartRateValues) && hr.heartRateValues.length > 0,
            heartRateValues: Array.isArray(hr.heartRateValues) ? hr.heartRateValues : []
        },
        wellnessStatus: {
            stress: wellness.stress?.status === 'available' ? (Array.isArray(wellness.stress.data) ? wellness.stress.data : [wellness.stress.data]) : null,
            bodyBattery: wellness.bodyBattery?.status === 'available' ? (Array.isArray(wellness.bodyBattery.data) ? wellness.bodyBattery.data : [wellness.bodyBattery.data]) : null,
            hrv: wellness.hrv?.status === 'available' ? wellness.hrv.data : null,
            sleep: {
                totalSleepSeconds: wellness.sleep?.status === 'available' ? wellness.sleep.data.dailySleepDTO?.sleepTimeSeconds : null,
                deepSleepSeconds: wellness.sleep?.status === 'available' ? wellness.sleep.data.dailySleepDTO?.deepSleepSeconds : null,
                lightSleepSeconds: wellness.sleep?.status === 'available' ? wellness.sleep.data.dailySleepDTO?.lightSleepSeconds : null,
                remSleepSeconds: wellness.sleep?.status === 'available' ? wellness.sleep.data.dailySleepDTO?.remSleepSeconds : null
            }
        },
        recentActivities: activities.map((a: any) => ({
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
        })),
        dataFreshness: {
            profileLastUpdated: p.levelUpdateDate ?? null,
            lastHrDate: hr.calendarDate ?? null,
            lastActivityDate: lastActivity?.startTimeLocal ?? null
        },
        dailySummary: {
            steps: lifestyle.steps ?? null,
            stepsGoal: lifestyle.goal ?? null,
            activeCalories: lifestyle.activeCalories ?? null,
            totalCalories: lifestyle.totalCalories ?? null
        }
    };
}

// --- FINAL JSON SCHEMA ---

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
    };
    recentActivities: {
        swims: {
            date: string;
            distance_m: number;
            duration_s: number;
            avg_hr: number | null;
            training_load: number | null;
        }[];
        dives: {
            date: string;
            max_depth_m: number;
            bottom_time_s: number;
        }[];
    };
    onboarding: {
        primary_goal: string | null;
        secondary_goal: string | null;
        goal_timeline: {
            type: "3_months" | "6_months" | "custom_date" | string;
            value: string | null;
        };
        priority: string | null;
        injuries: {
            zone: string;
            category: string;
            severity: number;
        }[];
        equipment: {
            gym_access: boolean;
            home_equipment: string[];
        };
        preferences: {
            likes: string[];
            dislikes: string[];
            impact_tolerance: "low" | "medium" | "high" | null;
            preferred_intensity: number | null;
        };
        lifestyle: {
            sleep_quality: number | null;
            stress_level: number | null;
            energy_level: number | null;
        };
        availability: {
            sessions_per_week: number | null;
            session_duration_min: number | null;
            weekly_volume_minutes: number | null;
        };
        algorithm_recommendations: {
            recommended_sessions_per_week: number | null;
            recommended_session_duration_min: number | null;
            target_weekly_minutes: number | null;
            volume_match_score: number | null;
        };
        fitness_tests: {
            pushups_max: number | null;
            squats_max: number | null;
            plank_seconds: number | null;
            mobility_score: number | null;
        };
    };
}

export function generateFinalJson(profile: HunoProfile, onboardingData: any, rawGarminActivities: any[] = []): HunoSchema {
    const meta = profile.garminMeta;
    const p = profile.identity;
    const c = profile.cardioStatus;
    const w = profile.wellnessStatus;

    // normalize onboarding answers
    const o = onboardingData || {};

    // calculate goals
    const secondaryGoalsRaw = o['secondary_goals'] || [];
    const secondaryGoalStr = Array.isArray(secondaryGoalsRaw)
        ? secondaryGoalsRaw.filter((g: string) => g !== 'none').join(', ')
        : (secondaryGoalsRaw === 'none' ? null : secondaryGoalsRaw);

    // timelines
    let timelineType = o['goal_timeline'] || '3_months'; // default
    let timelineValue = null;
    if (timelineType === 'custom_date') {
        timelineValue = o['custom_date_value'] || null;
    }

    // injuries map
    const injuriesRaw = [];
    if (o['has_injuries'] === 'yes') {
        const zones = (o['injury_zones'] as string[]) || [];
        for (const z of zones) {
            // Try to find severity/nature answers
            const nature = o[`injury_nature_${z}`] || 'unknown';
            const severity = o[`injury_severity_${z}`] || 5;
            injuriesRaw.push({
                zone: z,
                category: nature,
                severity: Number(severity)
            });
        }
    }

    // equipment
    const equipRaw = (o['equipment'] as string[]) || [];
    const gymAccess = (o['training_place'] === 'gym' || equipRaw.includes('gym_full'));
    const homeEquip = equipRaw.filter((e: string) => e !== 'none' && e !== 'gym_full');

    // preferences
    const dislikes = (o['global_avoid_movements'] as string[]) || [];
    const likes = (o['favorite_activities'] as string[]) || [];

    // availability calculation
    const sessionsPerWeek = Number(o['sessions_per_week']) || 0;
    const sessionDur = Number(o['session_duration']) || 0;
    const weeklyVol = sessionsPerWeek * sessionDur;

    // recommendations
    const algo = o['algorithm_recommendations'] || {};
    const targetVol = algo.target_weekly_minutes || 0;
    let score = 0;
    if (targetVol > 0) {
        score = Math.min(100, Math.round((weeklyVol / targetVol) * 100));
    }

    // Activities filtering
    const swims = (rawGarminActivities || []).filter((a: any) => a.activityType?.typeKey === 'lap_swimming').map((a: any) => ({
        date: a.startTimeLocal,
        distance_m: a.distance || 0,
        duration_s: a.duration || 0,
        avg_hr: a.averageHR || null,
        training_load: a.activityTrainingLoad || null
    }));

    const dives = (rawGarminActivities || []).filter((a: any) => a.activityType?.typeKey === 'single_gas_diving').map((a: any) => ({
        date: a.startTimeLocal,
        max_depth_m: a.maxDepth || 0,
        bottom_time_s: a.duration || 0
    }));

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
            sleep_available: !!w.sleep.totalSleepSeconds,
            stress_available: w.stress && w.stress.length > 0,
            hrv_available: w.hrv && w.hrv.length > 0
        },
        recentActivities: {
            swims,
            dives
        },
        onboarding: {
            primary_goal: o['main_goal'] || null,
            secondary_goal: secondaryGoalStr || null,
            goal_timeline: {
                type: timelineType,
                value: timelineValue
            },
            priority: o['priority'] || null,
            injuries: injuriesRaw,
            equipment: {
                gym_access: gymAccess,
                home_equipment: homeEquip
            },
            preferences: {
                likes: likes,
                dislikes: dislikes.filter(d => d !== 'none'),
                impact_tolerance: "medium",
                preferred_intensity: null
            },
            lifestyle: {
                sleep_quality: null,
                stress_level: null,
                energy_level: null
            },
            availability: {
                sessions_per_week: sessionsPerWeek || null,
                session_duration_min: sessionDur || null,
                weekly_volume_minutes: weeklyVol || null
            },
            algorithm_recommendations: {
                recommended_sessions_per_week: algo.recommended_sessions_per_week || null,
                recommended_session_duration_min: algo.recommended_session_duration_min || null,
                target_weekly_minutes: algo.target_weekly_minutes || null,
                volume_match_score: score
            },
            fitness_tests: {
                pushups_max: Number(o['pushups_count']) || null,
                squats_max: Number(o['squats_count']) || null,
                plank_seconds: Number(o['plank_seconds']) || null,
                mobility_score: null
            }
        }
    };
}
