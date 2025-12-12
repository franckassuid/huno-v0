export type Sex = "male" | "female" | "other" | "Homme" | "Femme" | "Autre";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type MainGoal =
    | "fat_loss" | "weight_loss"
    | "body_recomp"
    | "muscle_gain"
    | "performance" | "cardio"
    | "health" | "fitness" | "energy";

export interface TrainingProfileInput {
    sex: Sex;
    age: number;
    heightCm: number;
    weightKg: number;
    mainGoal: MainGoal;
    secondaryGoals?: MainGoal[] | null;
    timeHorizon: "1m" | "3m" | "6m" | { type: "customDate"; dateISO: string } | string;
    absolutePriority: "health" | "performance" | "aesthetics" | "balance" | "speed" | "habit";
    activityLevel?: ActivityLevel;

    // 👉 New: lifestyle
    sleepQuality?: "poor" | "average" | "good";
    stressLevel?: "low" | "medium" | "high";
    energyLevel?: "low" | "medium" | "high";

    // 👉 New: physical tests
    tests?: {
        pushupsMax?: number;     // max push-ups
        squatsMax?: number;      // max bodyweight squats
        plankSeconds?: number;   // plank hold in seconds
    };

    // 👉 New: injuries
    injuries?: {
        hasLowerBackIssue?: boolean;
        hasKneeIssue?: boolean;
        hasShoulderIssue?: boolean;
        hasHipIssue?: boolean;
        severity?: "low" | "medium" | "high"; // global perceived severity
    };
}

export interface TrainingPrescription {
    targetWeeklyMinutes: number;
    recommendedSessionsPerWeek: number;
    recommendedSessionDurationMin: number;
}

export function calculateTrainingRecommendation(
    profile: TrainingProfileInput
): TrainingPrescription {
    const {
        sex,
        age,
        heightCm,
        weightKg,
        mainGoal,
        timeHorizon,
        absolutePriority,
        activityLevel = "moderate", // Default fallback if missing from onboarding

        // New fields defaults
        sleepQuality = "average",
        stressLevel = "medium",
        energyLevel = "medium",
        tests,
        injuries,
    } = profile;

    // 1) BMI
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    // 2) Nombre de semaines jusqu'à l'objectif
    let weeksToGoal: number;
    if (timeHorizon === "1m") weeksToGoal = 4;
    else if (timeHorizon === "3m") weeksToGoal = 12;
    else if (timeHorizon === "6m") weeksToGoal = 24;
    else if (typeof timeHorizon === 'object' && timeHorizon !== null && 'dateISO' in timeHorizon) {
        const today = new Date();
        const target = new Date((timeHorizon as any).dateISO);
        const diffDays = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        weeksToGoal = Math.max(4, diffDays / 7); // min 4 semaines
    } else {
        // Fallback for custom strings or unexpected types
        weeksToGoal = 12;
    }

    // 3) Base volume selon l'objectif principal
    let targetWeeklyMinutes: number;
    switch (mainGoal) {
        case "fat_loss":
        case "weight_loss":
        case "body_recomp":
            targetWeeklyMinutes = 180; // base 3h
            break;
        case "muscle_gain":
            targetWeeklyMinutes = 150; // 2h30 ciblées force
            break;
        case "performance":
        case "cardio":
            targetWeeklyMinutes = 210; // 3h30
            break;
        case "health":
        case "fitness":
        case "energy":
        default:
            targetWeeklyMinutes = 120; // 2h (guidelines santé)
            break;
    }

    // 4) Ajustement selon horizon de temps (plus c’est court, plus on pousse)
    if (weeksToGoal <= 4) {
        targetWeeklyMinutes *= 1.2;
    } else if (weeksToGoal <= 8) {
        targetWeeklyMinutes *= 1.1;
    } else if (weeksToGoal >= 20) {
        targetWeeklyMinutes *= 0.9;
    }

    // 5) Ajustement selon niveau d’activité actuel
    switch (activityLevel) {
        case "sedentary":
            targetWeeklyMinutes *= 0.7; // on reste progressif
            break;
        case "light":
            targetWeeklyMinutes *= 0.85;
            break;
        case "moderate":
            targetWeeklyMinutes *= 1.0;
            break;
        case "high":
            targetWeeklyMinutes *= 1.15; // peut encaisser plus de volume
            break;
    }

    // 6) Ajustement âge (progression un peu moins agressive quand on avance)
    if (age >= 60) {
        targetWeeklyMinutes *= 0.8;
    } else if (age >= 45) {
        targetWeeklyMinutes *= 0.9;
    } else if (age >= 30) {
        targetWeeklyMinutes *= 0.95;
    }

    // 7) Ajustement BMI (éviter d’envoyer trop de volume avec obésité)
    if (bmi >= 30) {
        targetWeeklyMinutes *= 0.85;
    } else if (bmi <= 18.5) {
        targetWeeklyMinutes *= 0.9;
    }

    // 8) Ajustement léger selon sexe et priorité
    if ((sex === "female" || sex === 'Femme') && absolutePriority === "performance") {
        targetWeeklyMinutes *= 0.95;
    }

    // --- NEW FACTORS ---

    // a) Lifestyle factor (sommeil / stress / énergie)
    let lifestyleFactor = 1;

    // Sleep
    if (sleepQuality === "poor") lifestyleFactor *= 0.8;
    else if (sleepQuality === "average") lifestyleFactor *= 0.95;
    else if (sleepQuality === "good") lifestyleFactor *= 1.05;

    // Stress
    if (stressLevel === "high") lifestyleFactor *= 0.85;
    else if (stressLevel === "medium") lifestyleFactor *= 0.95;
    else if (stressLevel === "low") lifestyleFactor *= 1.05;

    // Energy
    if (energyLevel === "low") lifestyleFactor *= 0.9;
    else if (energyLevel === "high") lifestyleFactor *= 1.05;

    // Safety clamp
    lifestyleFactor = Math.min(Math.max(lifestyleFactor, 0.7), 1.15);

    // b) Capacity factor (tests physiques)
    let capacityFactor = 1;

    const pushups = tests?.pushupsMax ?? null;
    const squats = tests?.squatsMax ?? null;
    const plank = tests?.plankSeconds ?? null;

    // Very low strength / capacity
    const veryLowStrength =
        (pushups !== null && pushups < 5) ||
        (squats !== null && squats < 10) ||
        (plank !== null && plank < 20);

    // Good strength / capacity
    const goodStrength =
        (pushups !== null && pushups >= 20) ||
        (squats !== null && squats >= 40) ||
        (plank !== null && plank >= 60);

    if (veryLowStrength) {
        capacityFactor *= 0.8;
    } else if (goodStrength) {
        capacityFactor *= 1.1;
    }

    capacityFactor = Math.min(Math.max(capacityFactor, 0.75), 1.2);

    // c) Injury factor (blessures)
    let injuryFactor = 1;

    const hasSeriousInjury =
        (injuries?.severity === "high") ||
        ([
            injuries?.hasLowerBackIssue,
            injuries?.hasKneeIssue,
            injuries?.hasShoulderIssue,
            injuries?.hasHipIssue,
        ].filter(Boolean).length >= 2);

    const hasMinorInjury = injuries?.severity === "medium";

    if (hasSeriousInjury) {
        injuryFactor *= 0.75;
    } else if (hasMinorInjury) {
        injuryFactor *= 0.9;
    }

    injuryFactor = Math.min(Math.max(injuryFactor, 0.7), 1);

    // d) Appliquer les facteurs au volume hebdo
    targetWeeklyMinutes = targetWeeklyMinutes * lifestyleFactor * capacityFactor * injuryFactor;

    // 9) Clamp final du volume hebdo (sécurité)
    targetWeeklyMinutes = Math.min(Math.max(targetWeeklyMinutes, 60), 360);

    // 10) Reco fréquence selon niveau
    let recommendedSessionsPerWeek: number;
    switch (activityLevel) {
        case "sedentary":
            recommendedSessionsPerWeek = 3;
            break;
        case "light":
            recommendedSessionsPerWeek = 3;
            break;
        case "moderate":
            recommendedSessionsPerWeek = 4;
            break;
        case "high":
            recommendedSessionsPerWeek = 5;
            break;
        default:
            recommendedSessionsPerWeek = 3;
    }

    // Boost fréquence si objectif perf + horizon court
    if (
        (mainGoal === "performance" || mainGoal === 'cardio') &&
        weeksToGoal <= 12 &&
        recommendedSessionsPerWeek < 6
    ) {
        recommendedSessionsPerWeek += 1;
    }

    // If serious injuries or very low strength -> avoid too many sessions per week
    if (hasSeriousInjury || veryLowStrength) {
        recommendedSessionsPerWeek = Math.min(recommendedSessionsPerWeek, 4);
    }

    // Clamp fréquence
    recommendedSessionsPerWeek = Math.min(
        Math.max(recommendedSessionsPerWeek, 2),
        6
    );

    // 11) Durée recommandée d’une séance
    let recommendedSessionDurationMin =
        targetWeeklyMinutes / recommendedSessionsPerWeek;

    // Clamp durée des séances
    recommendedSessionDurationMin = Math.round(
        Math.min(Math.max(recommendedSessionDurationMin, 20), 90) / 5
    ) * 5; // arrondi à 5 min

    return {
        targetWeeklyMinutes: Math.round(targetWeeklyMinutes),
        recommendedSessionsPerWeek,
        recommendedSessionDurationMin,
    };
}
