export interface TrainingRecommendationInput {
    sex: string;
    age: number;
    heightCm: number;
    weightKg: number;
    mainGoal: string;
    secondaryGoals: string[];
    timeHorizon: string | { type: 'customDate', dateISO: string };
    absolutePriority: string;
    sleepQuality?: string;
    stressLevel?: string;
    energyLevel?: string;
    tests?: {
        pushupsMax?: number;
        squatsMax?: number;
        plankSeconds?: number;
    };
    injuries?: {
        hasLowerBackIssue: boolean;
        hasKneeIssue: boolean;
        hasShoulderIssue: boolean;
        hasHipIssue: boolean;
        severity?: 'low' | 'medium' | 'high';
    };
}

export interface TrainingRecommendationOutput {
    recommendedSessionsPerWeek: number;
    recommendedSessionDurationMin: number;
    targetWeeklyMinutes: number;
}

export function calculateTrainingRecommendation(input: TrainingRecommendationInput): TrainingRecommendationOutput {
    // 1. Base Volume based on Goal
    let targetMinutes = 150; // WHO baseline

    switch (input.mainGoal) {
        case 'weight_loss':
            targetMinutes = 200;
            break;
        case 'muscle_gain':
            targetMinutes = 180;
            break;
        case 'fitness':
            targetMinutes = 150;
            break;
        case 'performance':
            targetMinutes = 240;
            break;
    }

    // 2. Adjust for Experience / Level (Proxy via Age/Tests if available)
    // Simple heuristic: younger/fitter might handle more
    if (input.tests?.pushupsMax && input.tests.pushupsMax > 30) targetMinutes += 20;

    // 3. Adjust for Constraints (Injuries, Stress)
    if (input.injuries?.severity === 'high') targetMinutes *= 0.7; // Reduce volume
    if (input.stressLevel === 'high') targetMinutes *= 0.8;

    // 4. Calculate Frequency vs Duration
    // Default to ~3-4 sessions
    let sessions = 3;
    if (targetMinutes > 180) sessions = 4;
    if (targetMinutes > 240) sessions = 5;

    // Cap sessions based on priority (Habit = frequent but short)
    if (input.absolutePriority === 'habit') sessions = Math.max(sessions, 4);

    // Calculate duration
    let duration = Math.round(targetMinutes / sessions / 5) * 5; // Round to nearest 5

    // Bounds
    duration = Math.max(20, Math.min(90, duration));
    sessions = Math.max(2, Math.min(6, sessions));

    // Recalculate target to match exact session*duration
    targetMinutes = sessions * duration;

    return {
        recommendedSessionsPerWeek: sessions,
        recommendedSessionDurationMin: duration,
        targetWeeklyMinutes: targetMinutes
    };
}
