'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Activity, ArrowLeft, ArrowRight, Ban, Battery, Calendar, Check,
    ChevronRight, ChevronLeft, Clock, Dumbbell, Flame, Heart, Home, Info, Layers,
    Pause, Play, RefreshCcw, Ruler, Settings, Smile, Sun, Target,
    Timer, Trophy, User, Zap, AlertCircle, Moon, Plus, Minus, X, Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import garminCache from '../../../garmin-cache.json';

// --- DATA TYPES ---

type QuestionType = 'choice' | 'multi-choice' | 'number' | 'slider' | 'body-map' | 'date';

interface Question {
    id: string;
    section: string;
    title: string;
    subtitle?: string;
    type: QuestionType;
    options?: { label: string; value: string; icon?: any }[];
    min?: number;
    max?: number;
    unit?: string;
    step?: number;
    conditional?: {
        questionId: string;
        value: any;
    };
    excludeAnswerFrom?: string;
    zoneName?: string;
}

// --- BODY MAP SVG COMPONENT ---

const BodyMap = ({ gender, selectedZones, onToggleZone }: { gender: string, selectedZones: string[], onToggleZone: (zone: string) => void }) => {
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);

    // Determines the image based on gender
    const imageSrc = gender === 'Femme' ? '/body-map-woman.png' : '/body-map-man.png';

    // UPDATED ZONES KEYS to match INJURY_DATA key
    // Adjusted positions for the new image (normalized to 320x600 approximately)
    // UPDATED ZONES KEYS to match INJURY_DATA key
    // Adjusted positions for the new image (normalized to 320x600 approximately)

    // Male: Wider shoulders, narrower hips
    const maleZones = [
        { id: 'neck_cervical', name: 'Cou', cx: 160, cy: 65, r: 25 },
        { id: 'shoulder', name: 'Épaules', cx: 160, cy: 110, r: 35, offset: 75 },
        { id: 'chest_pectoral', name: 'Pectoraux', cx: 160, cy: 160, r: 35, offset: 45 },
        { id: 'upper_back', name: 'Haut du dos', cx: 160, cy: 140, r: 30, offset: 0 },
        { id: 'lower_back', name: 'Bas du dos', cx: 160, cy: 260, r: 40 },
        { id: 'elbow', name: 'Coudes', cx: 160, cy: 230, r: 30, offset: 95 },
        { id: 'wrist_hand', name: 'Poignets', cx: 160, cy: 340, r: 25, offset: 115 },
        { id: 'hip_glutes', name: 'Hanches', cx: 160, cy: 310, r: 40, offset: 50 },
        { id: 'knee', name: 'Genoux', cx: 160, cy: 450, r: 35, offset: 50 },
        { id: 'ankle', name: 'Chevilles', cx: 160, cy: 560, r: 30, offset: 40 },
    ];

    // Female: Narrower shoulders, wider hips, slightly different height ratios
    const femaleZones = [
        { id: 'neck_cervical', name: 'Cou', cx: 160, cy: 65, r: 25 },
        { id: 'shoulder', name: 'Épaules', cx: 160, cy: 115, r: 35, offset: 60 }, // Narrower
        { id: 'chest_pectoral', name: 'Poitrine', cx: 160, cy: 165, r: 35, offset: 35 }, // Narrower
        { id: 'upper_back', name: 'Haut du dos', cx: 160, cy: 155, r: 30, offset: 0 },
        { id: 'lower_back', name: 'Bas du dos', cx: 160, cy: 265, r: 40 },
        { id: 'elbow', name: 'Coudes', cx: 160, cy: 235, r: 30, offset: 85 }, // Closer to body
        { id: 'wrist_hand', name: 'Poignets', cx: 160, cy: 340, r: 25, offset: 105 },
        { id: 'hip_glutes', name: 'Hanches', cx: 160, cy: 315, r: 45, offset: 60 }, // Wider
        { id: 'knee', name: 'Genoux', cx: 160, cy: 450, r: 35, offset: 45 }, // Slightly closer (Q-angle)
        { id: 'ankle', name: 'Chevilles', cx: 160, cy: 560, r: 30, offset: 35 },
    ];

    const zones = gender === 'Femme' ? femaleZones : maleZones;

    return (
        <div className="relative w-full max-w-[220px] md:max-w-[260px] mx-auto animate-in fade-in zoom-in duration-700 my-0 md:my-2">
            {/* Glow / Aura */}
            <div className="absolute inset-0 bg-blue-500/10 blur-[50px] rounded-full" />

            <div className="relative w-full h-auto aspect-[160/300]">
                {/* New Generated Image */}
                <img
                    src={imageSrc}
                    alt={`Body Map ${gender}`}
                    className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] opacity-90"
                />

                {/* SVG Overlay for Interactive Zones */}
                <svg viewBox="0 0 320 600" className="absolute inset-0 w-full h-full overflow-visible">
                    {zones.map((zone) => {
                        const isSelected = selectedZones.includes(zone.id);
                        const isHovered = hoveredZone === zone.id;
                        const points = zone.offset
                            ? [{ x: zone.cx - zone.offset, y: zone.cy }, { x: zone.cx + zone.offset, y: zone.cy }]
                            : [{ x: zone.cx, y: zone.cy }];

                        return points.map((p, i) => (
                            <g
                                key={`${zone.id}-${i}`}
                                onClick={() => onToggleZone(zone.id)}
                                onMouseEnter={() => setHoveredZone(zone.id)}
                                onMouseLeave={() => setHoveredZone(null)}
                                className="cursor-pointer group"
                            >
                                {isSelected && (
                                    <circle cx={p.x} cy={p.y} r={zone.r * 1.2} fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.6">
                                        <animate attributeName="r" from={zone.r} to={zone.r * 1.5} dur="1.5s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={zone.r}
                                    fill={isSelected ? '#ef4444' : 'transparent'}
                                    stroke={isSelected ? '#f87171' : 'transparent'}
                                    strokeWidth="2"
                                    className="group-hover:fill-white/10 transition-all duration-300"
                                />

                                {/* Hover Label */}
                                {isHovered && (
                                    <g pointerEvents="none" className="hidden md:block">
                                        <rect
                                            x={p.x - (zone.name.length * 4)}
                                            y={p.y - zone.r - 28}
                                            width={zone.name.length * 8 + 10}
                                            height={24}
                                            rx={6}
                                            fill="rgba(0,0,0,0.9)"
                                            stroke="rgba(255,255,255,0.2)"
                                        />
                                        <text
                                            x={p.x}
                                            y={p.y - zone.r - 12}
                                            textAnchor="middle"
                                            fill="white"
                                            fontSize="13"
                                            fontWeight="bold"
                                        >
                                            {zone.name}
                                        </text>
                                    </g>
                                )}
                            </g>
                        ));
                    })}
                </svg>
            </div>

            {/* Legend - Tighter spacing */}
            <div className="absolute top-4 -right-12 md:-right-8 flex flex-col items-start gap-1.5 pointer-events-none">
                {zones.filter(z => selectedZones.includes(z.id)).map(z => (
                    <div key={z.id} className="pointer-events-auto animate-in slide-in-from-left fade-in duration-300 bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold text-red-100 shadow-xl flex items-center gap-1.5">
                        {z.name}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleZone(z.id);
                            }}
                            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- DATA: INJURY DETAILS ---
const INJURY_DATA = [
    {
        "id": "neck_cervical",
        "label": "Cou / cervicales",
        "issues": [
            { "id": "muscle_tension", "label": "Tension musculaire" },
            { "id": "torticollis", "label": "Torticolis" },
            { "id": "cervico_brachial_neuralgia", "label": "Névralgie cervico-brachiale" },
            { "id": "cervical_osteoarthritis", "label": "Arthrose cervicale" },
            { "id": "cervical_hernia", "label": "Hernie cervicale" },
            { "id": "whiplash_history", "label": "Douleur post-traumatique" }
        ]
    },
    {
        "id": "shoulder",
        "label": "Épaule",
        "issues": [
            { "id": "rotator_cuff_tendinitis", "label": "Tendinite coiffe des rotateurs" },
            { "id": "subacromial_impingement", "label": "Conflit sous-acromial" },
            { "id": "shoulder_bursitis", "label": "Bursite" },
            { "id": "shoulder_instability", "label": "Instabilité de l'articulation" },
            { "id": "shoulder_dislocation_history", "label": "Antécédent de luxation" },
            { "id": "rotator_cuff_partial_tear", "label": "Déchirure partielle coiffe" },
            { "id": "shoulder_calcifications", "label": "Calcifications" },
            { "id": "frozen_shoulder", "label": "Capsulite rétractile" }
        ]
    },
    {
        "id": "upper_arm", // Not on direct body map but good to have
        "label": "Bras",
        "issues": [
            { "id": "biceps_tendinitis", "label": "Tendinite bicipitale" },
            { "id": "triceps_tendinitis", "label": "Tendinite tricipitale" },
            { "id": "muscle_contracture", "label": "Contracture musculaire" }
        ]
    },
    {
        "id": "elbow",
        "label": "Coude",
        "issues": [
            { "id": "tennis_elbow", "label": "Tennis elbow (Externe)" },
            { "id": "golfer_elbow", "label": "Golfer’s elbow (Interne)" },
            { "id": "triceps_insertion_tendinitis", "label": "Tendinite du triceps" },
            { "id": "olecranon_bursitis", "label": "Bursite" }
        ]
    },
    {
        "id": "wrist_hand",
        "label": "Poignet / main",
        "issues": [
            { "id": "extensor_tendinitis", "label": "Tendinite des extenseurs" },
            { "id": "carpal_tunnel", "label": "Canal carpien" },
            { "id": "wrist_sprain", "label": "Entorse du poignet" },
            { "id": "wrist_osteoarthritis", "label": "Arthrose" }
        ]
    },
    {
        "id": "chest_pectoral",
        "label": "Pectoraux",
        "issues": [
            { "id": "pectoral_partial_tear", "label": "Déchirure partielle" },
            { "id": "pectoral_contracture", "label": "Contracture musculaire" },
            { "id": "costal_pain", "label": "Douleur costale" }
        ]
    },
    {
        "id": "upper_back",
        "label": "Haut du dos",
        "issues": [
            { "id": "trapezius_tension", "label": "Tension des trapèzes" },
            { "id": "between_scapula_pain", "label": "Douleurs entre omoplates" },
            { "id": "thoracic_junction_pain", "label": "Douleur charnière thoraco-lombaire" }
        ]
    },
    {
        "id": "lower_back",
        "label": "Bas du dos",
        "issues": [
            { "id": "lumbago", "label": "Lumbago aigu" },
            { "id": "chronic_low_back_pain", "label": "Lombalgie chronique" },
            { "id": "lumbar_hernia", "label": "Hernie discale" },
            { "id": "sciatica", "label": "Sciatique" }
        ]
    },
    {
        "id": "hip_glutes",
        "label": "Hanches",
        "issues": [
            { "id": "gluteus_medius_tendinitis", "label": "Tendinite moyen fessier" },
            { "id": "piriformis_syndrome", "label": "Syndrome du piriforme" },
            { "id": "hip_osteoarthritis", "label": "Arthrose de la hanche" },
            { "id": "trochanteric_bursitis", "label": "Bursite trochantérienne" }
        ]
    },
    {
        "id": "knee",
        "label": "Genou",
        "issues": [
            { "id": "patellofemoral_syndrome", "label": "Syndrome fémoro-patellaire" },
            { "id": "patellar_tendinitis", "label": "Tendinite rotulienne" },
            { "id": "acl_pcl_history", "label": "LCA / LCP" },
            { "id": "meniscus_issue", "label": "Ménisque" },
            { "id": "knee_osteoarthritis", "label": "Arthrose" }
        ]
    },
    {
        "id": "ankle",
        "label": "Cheville",
        "issues": [
            { "id": "lateral_ankle_sprain", "label": "Entorse externe" },
            { "id": "chronic_ankle_instability", "label": "Instabilité chronique" },
            { "id": "achilles_tendinitis", "label": "Tendinite d’Achille" }
        ]
    }
];

// --- MAIN PAGE ---

import { calculateTrainingRecommendation } from '../../lib/fitness-engine';

// ... (existing imports)

// ... (existing helper functions if any)

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isLoaded, setIsLoaded] = useState(false);

    // --- RECOMMENDATION ENGINE ---

    // 1. Calculate Injury Severity first to pass it correctly
    const injuryZonesRaw = (answers['injury_zones'] as string[]) || [];
    let maxInjurySeverity = 0;
    injuryZonesRaw.forEach(z => {
        const val = answers[`inj_${z}_intensity`];
        if (val) maxInjurySeverity = Math.max(maxInjurySeverity, Number(val));
    });
    const severityInput = maxInjurySeverity > 7 ? 'high' : (maxInjurySeverity > 3 ? 'medium' : 'low');

    // 2. Main Calculation
    // Recalculates whenever 'answers' change
    const recommendation = calculateTrainingRecommendation({
        sex: answers['sex'] || 'Homme',
        age: answers['age'] || 30,
        heightCm: answers['height'] || 175,
        weightKg: answers['weight'] || 75,
        mainGoal: answers['main_goal'] || 'fitness',
        secondaryGoals: answers['secondary_goals'] || [],
        timeHorizon: answers['goal_timeline'] === 'custom_date' && answers['custom_date_value']
            ? { type: 'customDate' as const, dateISO: answers['custom_date_value'] }
            : (answers['goal_timeline'] || '3m'),
        absolutePriority: answers['priority'] || 'health',

        // New Factors Mapping
        sleepQuality: answers['sleep_quality'],
        stressLevel: answers['stress_level'],
        energyLevel: answers['energy_level'],

        tests: {
            pushupsMax: answers['pushups_count'],
            squatsMax: answers['squats_count'],
            plankSeconds: answers['plank_seconds'],
        },

        injuries: {
            hasLowerBackIssue: injuryZonesRaw.includes('lower_back'),
            hasKneeIssue: injuryZonesRaw.includes('knee'),
            hasShoulderIssue: injuryZonesRaw.includes('shoulder') || injuryZonesRaw.includes('shoulder_left') || injuryZonesRaw.includes('shoulder_right'),
            hasHipIssue: injuryZonesRaw.includes('hip_glutes'),
            severity: injuryZonesRaw.length > 0 ? (severityInput as any) : undefined,
        }
    });

    // Load data for pre-fill
    useEffect(() => {
        setIsLoaded(true);
        try {
            const cacheAny = garminCache as any;
            const keys = Object.keys(cacheAny);
            if (keys.length > 0) {
                const data = cacheAny[keys[0]]?.data;
                const profile = data?.profile;

                if (profile) {
                    setAnswers(prev => ({
                        ...prev,
                        age: profile.age,
                        height: profile.height, // cm from Garmin
                        weight: profile.weight ? Math.round(profile.weight / 1000) : undefined // g -> kg
                    }));
                }
            }
        } catch (e) {
            console.error("Failed to load cache for onboarding", e);
        }
    }, []);

    // ... (baseQuestions definitions)


    // --- VALIDATION HELPER ---
    const getDurationValidation = () => {
        if (currentQ?.id !== 'session_duration') return { status: 'ok', message: null };

        const sessionsPerWeek = answers['sessions_per_week'] || recommendation.recommendedSessionsPerWeek;
        const duration = answers['session_duration'] || 0; // Current slider value

        // Use displayed val (defaulting to recommendation if 0) for calculation
        const displayedDuration = duration || recommendation.recommendedSessionDurationMin;

        // 1. Check against the EXPLICIT recommendation (Practical Baseline)
        // If the user is at or above the *recommended* counts, it is ALWAYS valid, 
        // even if it falls short of the theoretical "targetWeeklyMinutes" (volume).
        const recommendedVolume = recommendation.recommendedSessionsPerWeek * recommendation.recommendedSessionDurationMin;
        const userVolume = sessionsPerWeek * displayedDuration;

        if (userVolume >= recommendedVolume * 0.95) {
            return { status: 'ok', message: null };
        }

        // 2. Fallback: Check against theoretical target (if they customized it differently)
        const volumeRatio = userVolume / recommendation.targetWeeklyMinutes;

        if (volumeRatio < 0.6) {
            return {
                status: 'error',
                message: 'Avec cette fréquence et cette durée, il sera très difficile d’atteindre ton objectif dans les temps. Tu peux soit augmenter la durée de tes séances, soit revenir en arrière pour augmenter le nombre de séances.'
            };
        }
        if (volumeRatio < 0.8) {
            return {
                status: 'warning',
                message: 'C’est un peu léger pour ton objectif, mais ça reste jouable si tu es régulier.'
            };
        }
        return { status: 'ok', message: null };
    };




    // --- DYNAMIC QUESTIONS CONST ---
    // Removed useMemo to ensure dynamic injury questions update immediately when answers change
    // This avoids stale closure issues or memoization delays with complex dependencies
    const baseQuestions: Question[] = [

        // SECTION 1: Profil Physique
        {
            id: 'sex',
            section: 'Profil Physique',
            title: 'Sexe Biologique',
            subtitle: 'Homme, Femme ou Non spécifié.',
            type: 'choice',
            options: [
                { label: 'Homme', value: 'Homme', icon: User },
                { label: 'Femme', value: 'Femme', icon: User },
                { label: 'Ne souhaite pas répondre', value: 'Autre', icon: Ban },
            ]
        },
        {
            id: 'age',
            section: 'Profil Physique',
            title: 'Quel est ton âge ?',
            type: 'slider',
            min: 10, max: 100, unit: 'ans'
        },
        {
            id: 'height',
            section: 'Profil Physique',
            title: 'Quelle est ta taille ?',
            type: 'slider',
            min: 100, max: 230, unit: 'cm'
        },
        {
            id: 'weight',
            section: 'Profil Physique',
            title: 'Quel est ton poids ?',
            type: 'slider',
            min: 30, max: 200, unit: 'kg'
        },

        // SECTION 2: Objectifs
        {
            id: 'main_goal',
            section: 'Objectifs',
            title: 'Objectif Principal',
            subtitle: 'Choisis ta priorité numéro 1.',
            type: 'choice',
            options: [
                { label: 'Perdre du poids', value: 'weight_loss', icon: Target },
                { label: 'Prendre du muscle', value: 'muscle_gain', icon: Dumbbell },
                { label: 'Être en forme', value: 'fitness', icon: Activity },
                { label: 'Cardio', value: 'cardio', icon: Heart },
                { label: 'Énergie', value: 'energy', icon: Zap },
            ]
        },
        {
            id: 'secondary_goals',
            section: 'Objectifs',
            title: 'Objectifs Secondaires',
            subtitle: 'Sélectionne-en plusieurs si tu le souhaites.',
            type: 'multi-choice',
            excludeAnswerFrom: 'main_goal',
            options: [
                { label: 'Perdre du poids', value: 'weight_loss', icon: Target },
                { label: 'Prendre du muscle', value: 'muscle_gain', icon: Dumbbell },
                { label: 'Être en forme', value: 'fitness', icon: Activity },
                { label: 'Cardio', value: 'cardio', icon: Heart },
                { label: 'Énergie', value: 'energy', icon: Zap },
                { label: 'Mobilité', value: 'mobility', icon: Layers },
                { label: 'Aucun', value: 'none', icon: Ban },
            ]
        },
        {
            id: 'goal_timeline',
            section: 'Objectifs',
            title: 'Horizon de temps',
            type: 'choice',
            options: [
                { label: '1 mois', value: '1m', icon: Clock },
                { label: '3 mois', value: '3m', icon: Clock },
                { label: '6 mois', value: '6m', icon: Clock },
                { label: 'Date précise', value: 'custom_date', icon: Calendar },
            ]
        },
        {
            id: 'custom_date_value',
            section: 'Objectifs',
            title: 'Quelle date visez-vous ?',
            type: 'date',
            conditional: { questionId: 'goal_timeline', value: 'custom_date' }
        },
        {
            id: 'priority',
            section: 'Objectifs',
            title: 'Ta priorité absolue',
            subtitle: 'Ce qui compte le plus pour toi aujourd\'hui.',
            type: 'choice',
            options: [
                { label: 'Résultats rapides', value: 'speed', icon: Zap },
                { label: 'Santé / Longévité', value: 'health', icon: Heart },
                { label: 'Esthétique', value: 'aesthetics', icon: Trophy },
                { label: 'Performance', value: 'performance', icon: Flame },
                { label: 'Régularité', value: 'habit', icon: Activity },
            ]
        },

        // SECTION 3: Organisation

        {
            id: 'training_place',
            section: 'Organisation',
            title: 'Lieu d\'entraînement',
            subtitle: 'Plusieurs choix possibles.',
            type: 'multi-choice', // Changed to multi-choice
            options: [
                { label: 'Maison', value: 'home', icon: Home },
                { label: 'Salle', value: 'gym', icon: Dumbbell },
            ]
        },
        {
            id: 'equipment',
            section: 'Organisation',
            title: 'Matériel à disposition',
            type: 'multi-choice',
            options: [
                { label: 'Tapis', value: 'mat', icon: Layers },
                { label: 'Haltères légers', value: 'dumbbells_light', icon: Dumbbell },
                { label: 'Haltères moyens', value: 'dumbbells_med', icon: Dumbbell },
                { label: 'Haltères lourds', value: 'dumbbells_heavy', icon: Dumbbell },
                { label: 'Élastiques', value: 'bands', icon: Activity },
                { label: 'Kettlebell', value: 'kettlebell', icon: Dumbbell },
                { label: 'Barre de traction', value: 'pullup_bar', icon: Ruler },
                { label: 'Step / Box', value: 'step', icon: Layers },
                { label: 'Aucun matériel', value: 'none', icon: Ban },
                // Conditional Logic update handled below
            ]
        },

        // SECTION 4: Blessures
        {
            id: 'has_injuries',
            section: 'Santé',
            title: 'Blessures / Douleurs',
            subtitle: 'Important pour adapter les mouvements.',
            type: 'choice',
            options: [
                { label: 'Oui', value: 'yes', icon: AlertCircle },
                { label: 'Non', value: 'no', icon: Check },
            ]
        },
        {
            id: 'injury_zones',
            section: 'Santé',
            title: 'Zones douloureuses',
            subtitle: 'Touchez le corps pour indiquer les zones.',
            type: 'body-map',
            conditional: { questionId: 'has_injuries', value: 'yes' }
        },
    ];

    // ADD MACHINE OPTION DYNAMICALLY
    const trainingPlace = (answers['training_place'] as string[]) || []; // Now an array
    const hasGym = trainingPlace.includes('gym');

    // Find equipment question to inject machines if needed
    const equipmentQ = baseQuestions.find(q => q.id === 'equipment');
    if (equipmentQ && hasGym) {
        if (!equipmentQ.options?.find(o => o.value === 'machines')) {
            equipmentQ.options?.push({ label: 'Machines guidées', value: 'machines', icon: Zap });
        }
    }

    // DYNAMIC INJURY LOOP
    const injuryZones = (answers['injury_zones'] as string[]) || [];
    const injuryQuestions: Question[] = [];

    injuryZones.forEach(zone => {
        const zoneData = INJURY_DATA.find(z => z.id === zone);
        const zoneLabel = zoneData?.label || zone;
        const issueOptions = zoneData?.issues.map(i => ({ label: i.label, value: i.id })) || [{ label: 'Autre', value: 'other' }];

        injuryQuestions.push(
            {
                id: `inj_${zone}_nature`,
                section: 'Détails Blessure',
                title: `Douleur : ${zoneLabel}`,
                subtitle: 'De quel type de blessure s\'agit-il ?',
                type: 'choice',
                zoneName: zone,
                conditional: { questionId: 'has_injuries', value: 'yes' },
                options: issueOptions
            },
            {
                id: `inj_${zone}_intensity`,
                section: 'Détails Blessure',
                title: `Intensité : ${zoneLabel}`,
                subtitle: 'Sur une échelle de 1 à 10 ?',
                type: 'slider',
                min: 1, max: 10, unit: '/ 10',
                conditional: { questionId: 'has_injuries', value: 'yes' },
            },
            {
                id: `inj_${zone}_duration`,
                section: 'Détails Blessure',
                title: `Ancienneté : ${zoneLabel}`,
                subtitle: 'Depuis combien de temps ?',
                type: 'choice',
                conditional: { questionId: 'has_injuries', value: 'yes' },
                options: [
                    { label: '< 1 mois', value: 'less_1m' },
                    { label: '1 - 6 mois', value: '1m_6m' },
                    { label: '> 6 mois', value: 'more_6m' },
                ]
            }
        );
    });

    // Add Movements to Avoid at the end of injury section, if injuries exist OR generic check

    // Always ask movements to avoid
    const hasInjuries = answers['has_injuries'] === 'yes';
    injuryQuestions.push({
        id: `global_avoid_movements`,
        section: 'Précautions',
        title: `Mouvements à éviter`,
        subtitle: hasInjuries
            ? `En raison de tes blessures ou simplement parce que tu n'aimes pas ces mouvements.`
            : `Y a-t-il des mouvements que tu n'aimes pas ou qui te mettent mal à l'aise ?`,
        type: 'multi-choice',
        // conditional: { questionId: 'has_injuries', value: 'yes' }, // REMOVED to show always
        options: [
            { label: 'Sauts', value: 'jumps', icon: Activity },
            { label: 'Courses (impacts)', value: 'running', icon: Timer },
            { label: 'Flexions profondes', value: 'deep_flexion', icon: Layers },
            { label: 'Charges lourdes', value: 'heavy_load', icon: Dumbbell },
            { label: 'Impacts directs', value: 'impacts', icon: Zap },
            { label: 'Mouvements au-dessus de la tête', value: 'overhead', icon: Ruler },
            { label: 'Aucun', value: 'none', icon: Check },
        ]
    });

    // 3. Dynamic Duration Adjustment
    // If user selected a custom frequency, adapt the recommended duration to match target volume
    const selectedFreq = answers['sessions_per_week'] || recommendation.recommendedSessionsPerWeek;
    const adjustedDuration = Math.max(5, Math.min(90, Math.round((recommendation.targetWeeklyMinutes / selectedFreq) / 5) * 5));

    // Continue with LEVEL
    const levelQuestions: Question[] = [
        // 6. Préférences
        {
            id: 'preferred_intensity',
            section: 'Préférences',
            title: 'Intensité Préférée',
            subtitle: 'A quel point aimes-tu "souffrir" ?',
            type: 'slider',
            min: 1, max: 10, unit: '/ 10'
        },
        // 7. Lifestyle (moved from base questions)
        {
            id: 'sleep_quality',
            section: 'Mode de vie',
            title: 'Qualité de sommeil',
            subtitle: 'Comment dors-tu en général ?',
            type: 'choice',
            options: [
                { label: 'Bon', value: 'good', icon: Moon },
                { label: 'Moyen', value: 'average', icon: Battery },
                { label: 'Mauvais', value: 'poor', icon: AlertCircle },
            ]
        },
        {
            id: 'stress_level',
            section: 'Mode de vie',
            title: 'Niveau de stress',
            subtitle: 'Stress perçu au quotidien.',
            type: 'choice',
            options: [
                { label: 'Faible', value: 'low', icon: Sun },
                { label: 'Moyen', value: 'medium', icon: Activity },
                { label: 'Élevé', value: 'high', icon: Zap },
            ]
        },
        {
            id: 'energy_level',
            section: 'Mode de vie',
            title: 'Niveau d\'énergie',
            subtitle: 'En général, au quotidien.',
            type: 'choice',
            options: [
                { label: 'Faible', value: 'low', icon: Battery },
                { label: 'Moyen', value: 'medium', icon: Zap },
                { label: 'Élevé', value: 'high', icon: Flame },
            ]
        },
        // 8. Tests physiques
        {
            id: 'pushups_count',
            section: 'Niveau Actuel',
            title: 'Test : Pompes',
            subtitle: 'Max de pompes (clean form) d\'affilée ?',
            type: 'slider',
            min: 0, max: 50, unit: 'reps'
        },
        {
            id: 'squats_count',
            section: 'Niveau Actuel',
            title: 'Test : Squats',
            subtitle: 'Combien de squats au poids du corps d\'affilée ?',
            type: 'slider',
            min: 0, max: 100, unit: 'reps'
        },
        {
            id: 'plank_seconds',
            section: 'Niveau Actuel',
            title: 'Test : Gainage',
            subtitle: 'Temps maximum en position de planche ?',
            type: 'slider',
            min: 0, max: 120, unit: 'sec'
        },
        {
            id: 'mobility_score',
            section: 'Niveau Actuel',
            title: 'Mobilité',
            subtitle: 'Touche tes orteils jambes tendues ?',
            type: 'choice',
            options: [
                { label: 'Facilement (mains au sol)', value: 'high', icon: Check },
                { label: 'Juste (bout des doigts)', value: 'medium', icon: Activity },
                { label: 'Pas du tout', value: 'low', icon: Ban },
                { label: 'Je ne sais pas', value: 'unknown', icon: Info },
            ]
        },
        // 9. Reco Fréquence
        {
            id: 'sessions_per_week',
            section: 'Organisation',
            title: 'Fréquence',
            subtitle: 'Séances par semaine',
            type: 'slider',
            min: 1, max: 7, unit: 'séances'
        },
        // 10. Reco Durée
        {
            id: 'session_duration',
            section: 'Organisation',
            title: 'Durée idéale',
            subtitle: `Temps disponible par séance (recommandé : ${adjustedDuration} min)`,
            type: 'slider',
            min: 5, max: 90, step: 1, unit: 'min'
        }
    ];

    const questions = [...baseQuestions, ...injuryQuestions, ...levelQuestions];

    // activeQuestions logic - removed useMemo to force re-calc
    const activeQuestions = questions.filter(q => {
        if (!q.conditional) return true;
        return answers[q.conditional.questionId] === q.conditional.value;
    });

    const currentQ = activeQuestions[currentStep];

    // --- AUTO-FILL DEFAULTS EFFECT (Re-inserted correctly) ---
    useEffect(() => {
        if (!currentQ) return;

        const key = currentQ.id;
        const val = answers[key];

        if (key === 'sessions_per_week' && val === undefined) {
            setAnswers(prev => ({ ...prev, [key]: recommendation.recommendedSessionsPerWeek }));
        } else if (key === 'session_duration') {
            // For duration, we might want to update it if the recommendation (adjusted) changed
            // But to avoid fighting the user, we should probably check if it matches the OLD recommendation?
            // Simplest is to only set if undefined, OR if we want to be smart, set it.
            // Given user feedback "blocked", let's strictly use undefined for safety first.
            // If they go back and change frequency, they might need to manually adjust duration or we force reset?
            // Let's allow force adjustment if current value matches OLD adjusted? No, too complex.
            // Safe bet: auto-update only if undefined.
            if (val === undefined) {
                setAnswers(prev => ({ ...prev, [key]: adjustedDuration }));
            }
        }
    }, [currentQ?.id, recommendation.recommendedSessionsPerWeek, adjustedDuration, answers]);

    const validation = getDurationValidation();

    // --- VALIDATION & PROCEED LOGIC ---
    const isStepValid = () => {
        if (!currentQ) return false;
        const val = answers[currentQ.id];

        // Specific Duration Validation
        if (currentQ.id === 'session_duration') {
            // If validation is error AND not overridden
            if (validation.status === 'error' && !answers['lowVolumeOverride']) {
                return false;
            }
            return true;
        }

        switch (currentQ.type) {
            case 'multi-choice':
            case 'body-map':
                return Array.isArray(val) && val.length > 0;
            case 'date':
                return !!val;
            case 'choice':
                return !!val;
            case 'slider':
                return true;
            default:
                return true;
        }
    };

    const canProceed = isStepValid();

    const handleNext = () => {
        if (currentStep < activeQuestions.length - 1) {
            // SAVE COMPUTED DATA before moving on from specific steps? 
            // Requirement: "À la fin de cette étape, on doit avoir stocké..."
            if (currentQ.id === 'session_duration') {
                const sessions = answers['sessions_per_week'] || recommendation.recommendedSessionsPerWeek;
                const duration = answers['session_duration'] || Math.max(10, Math.min(90, Math.round((recommendation.targetWeeklyMinutes / sessions) / 5) * 5));

                // We set these into answers silently to persist them
                // Note: setAnswers is async, but we are moving next. 
                // Better to set them NOW.
                const extras = {
                    sessionsPerWeek: sessions,
                    sessionDurationMin: duration,
                    weeklyVolumeMinutes: sessions * duration,
                    targetWeeklyMinutes: recommendation.targetWeeklyMinutes,
                    recommendedSessionsPerWeek: recommendation.recommendedSessionsPerWeek,
                    recommendedSessionDurationMin: recommendation.recommendedSessionDurationMin,
                    // lowVolumeOverride is already in answers if clicked
                };
                setAnswers(prev => ({ ...prev, ...extras }));
            }

            setCurrentStep(prev => prev + 1);
        } else {
            // FINISHED
            console.log("Onboarding Finished", answers);

            // Persist full data including computed recommendations
            const finalData = {
                ...answers,
                algorithm_recommendations: {
                    recommended_sessions_per_week: recommendation.recommendedSessionsPerWeek,
                    recommended_session_duration_min: recommendation.recommendedSessionDurationMin,
                    target_weekly_minutes: recommendation.targetWeeklyMinutes,
                    // volume match score will be computed in the final JSON builder or here
                }
            };

            localStorage.setItem('huno-onboarding-data', JSON.stringify(finalData));
            window.dispatchEvent(new Event('storage')); // Trigger update if listening

            router.push('/');
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const setAnswer = (val: any) => {
        setAnswers(prev => ({ ...prev, [currentQ.id]: val }));
    };

    const toggleMultiSelect = (val: string) => {
        const current = (answers[currentQ.id] as string[]) || [];

        // Logic for "None" exclusive selection
        if (val === 'none') {
            if (current.includes('none')) {
                setAnswer([]); // Deselect proper
            } else {
                setAnswer(['none']); // Select none, clear others
            }
            return;
        }

        // If selecting something else, remove "none"
        let newSelection = current.filter(v => v !== 'none');

        if (newSelection.includes(val)) {
            newSelection = newSelection.filter(v => v !== val);
        } else {
            newSelection.push(val);
        }
        setAnswer(newSelection);
    };

    // --- RENDERERS ---

    const renderInput = () => {
        const val = answers[currentQ.id];

        switch (currentQ.type) {
            case 'choice':
                const mOptionsChoice = currentQ.options?.filter(opt => !['none', 'auter', 'Autre', 'other', 'unknown'].includes(opt.value)) || [];
                const sOptionsChoice = currentQ.options?.filter(opt => ['none', 'auter', 'Autre', 'other', 'unknown'].includes(opt.value)) || [];

                return (
                    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
                        <div className="flex flex-wrap justify-center gap-3 md:gap-4 w-full">
                            {mOptionsChoice.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => { setAnswer(opt.value); setTimeout(handleNext, 300); }}
                                    className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-3 md:p-6 rounded-2xl border transition-all duration-300 group hover:scale-[1.02] w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-[30%] ${val === opt.value
                                        ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-500/20'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {opt.icon && <div className="p-2 md:p-3 rounded-full bg-white/5"><opt.icon className="w-5 h-5 md:w-6 md:h-6" /></div>}
                                    <span className="font-bold text-sm md:text-lg text-center">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                        {sOptionsChoice.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => { setAnswer(opt.value); setTimeout(handleNext, 300); }}
                                className={`w-full py-3 rounded-xl border border-dashed transition-all duration-200 flex items-center justify-center gap-2 text-xs md:text-sm ${val === opt.value
                                    ? 'bg-white/10 border-blue-400 text-blue-300'
                                    : 'bg-transparent border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                                    }`}
                            >
                                {opt.icon && <opt.icon className="w-4 h-4" />}
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                );

            case 'multi-choice':
                const mainGoal = currentQ.excludeAnswerFrom ? answers[currentQ.excludeAnswerFrom] : null;
                const filteredOptions = currentQ.options?.filter(o => o.value !== mainGoal) || [];

                const mOptionsMulti = filteredOptions.filter(opt => !['none', 'auter', 'Autre', 'other', 'unknown'].includes(opt.value));
                const sOptionsMulti = filteredOptions.filter(opt => ['none', 'auter', 'Autre', 'other', 'unknown'].includes(opt.value));

                return (
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex flex-wrap justify-center gap-3 md:gap-4 w-full">
                            {mOptionsMulti.map((opt) => {
                                const isSelected = (val || []).includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => toggleMultiSelect(opt.value)}
                                        className={`relative flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-6 rounded-2xl border transition-all duration-200 w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-[30%] ${isSelected
                                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                                            }`}
                                    >
                                        {opt.icon && <opt.icon className={`w-6 h-6 md:w-8 md:h-8 ${isSelected ? 'text-white' : 'text-gray-500'}`} />}
                                        <span className="font-bold text-sm md:text-base text-center">{opt.label}</span>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-white text-blue-600 rounded-full p-0.5 md:p-1 shadow-sm">
                                                <Check className="w-2 h-2 md:w-3 md:h-3" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {sOptionsMulti.map((opt) => {
                            const isSelected = (val || []).includes(opt.value);
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleMultiSelect(opt.value)}
                                    className={`w-full py-3 rounded-xl border border-dashed transition-all duration-200 flex items-center justify-center gap-2 text-xs md:text-sm ${isSelected
                                        ? 'bg-white/10 border-blue-400 text-blue-300'
                                        : 'bg-transparent border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                                        }`}
                                >
                                    {opt.icon && <opt.icon className="w-4 h-4" />}
                                    <span>{opt.label}</span>
                                </button>
                            )
                        })}
                    </div>
                );

            case 'date':
                // Calculate min date (today + 30 days)
                const minDate = new Date();
                minDate.setDate(minDate.getDate() + 30);
                const minDateStr = minDate.toISOString().split('T')[0];

                return (
                    <div className="flex flex-col items-center animate-in zoom-in duration-300 gap-4">
                        <input
                            type="date"
                            value={val || ''}
                            onChange={(e) => setAnswer(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-xl px-8 py-6 text-3xl text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all cursor-pointer text-center"
                            min={minDateStr}
                        />
                        <p className="text-sm text-gray-400">
                            La date doit être fixée à au moins 30 jours pour un objectif réaliste.
                        </p>
                    </div>
                );

            case 'slider':
                const isMaxed = currentQ.max && val >= currentQ.max && ['pushups_count', 'squats_count', 'plank_seconds'].includes(currentQ.id);

                // DEFAULT VALUE LOGIC
                let defaultVal = currentQ.min || 0;

                if (currentQ.id === 'sessions_per_week') {
                    defaultVal = recommendation.recommendedSessionsPerWeek;
                } else if (currentQ.id === 'session_duration') {
                    // Use the dynamic adjusted duration (based on selected frequency)
                    defaultVal = adjustedDuration;
                }

                // If no value set, use default (visual)
                const currentVal = val !== undefined ? val : defaultVal;

                return (
                    <div className="w-full max-w-2xl mx-auto py-4 md:py-8">
                        {/* Display Value */}
                        <div className="flex items-center justify-center gap-4 md:gap-8 mb-8 md:mb-12">
                            <button
                                onClick={() => setAnswer(Math.max((currentQ.min || 0), currentVal - (currentQ.step || 1)))}
                                className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
                            >
                                <Minus className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                            </button>

                            <div className="text-center min-w-[120px] md:min-w-[160px]">
                                <span className={`text-6xl md:text-8xl font-black tracking-tighter relative ${isMaxed ? 'text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]' : 'text-white'}`}>
                                    {currentVal}
                                    {isMaxed && <span className="absolute top-0 -right-4 md:-right-8 text-2xl md:text-4xl text-blue-400 font-black">+</span>}
                                </span>
                                <span className="text-base md:text-xl text-gray-500 font-medium mt-2 block">{currentQ.unit}</span>
                            </div>

                            <button
                                onClick={() => setAnswer(Math.min((currentQ.max || 100), currentVal + (currentQ.step || 1)))}
                                className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
                            >
                                <Plus className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {/* Range Slider */}
                        <div className="relative h-2 bg-white/10 rounded-full w-full">
                            <div
                                className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-150"
                                style={{
                                    width: `${((currentVal - (currentQ.min || 0)) / ((currentQ.max || 100) - (currentQ.min || 0))) * 100}%`
                                }}
                            />
                            {/* Slider Thumb */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg shadow-blue-500/50 pointer-events-none transition-all duration-75 border-2 border-blue-500"
                                style={{
                                    left: `${((currentVal - (currentQ.min || 0)) / ((currentQ.max || 100) - (currentQ.min || 0))) * 100}%`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                            <input
                                type="range"
                                min={currentQ.min}
                                max={currentQ.max}
                                step={currentQ.step || 1}
                                value={currentVal}
                                onChange={(e) => setAnswer(parseInt(e.target.value))}
                                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>

                        {/* Maxed out message */}
                        {isMaxed && (
                            <div className="mt-6 flex items-center justify-center gap-2 text-green-400 animate-in fade-in slide-in-from-bottom-2">
                                <Trophy className="w-5 h-5" />
                                <span className="font-medium">Excellent niveau !</span>
                            </div>
                        )}

                        {/* VALIDATION MESSAGES for Duration */}
                        {currentQ.id === 'session_duration' && validation.message && (
                            <div className={`mt-8 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2 ${validation.status === 'error'
                                ? 'bg-red-500/10 border border-red-500/20 text-red-200'
                                : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200'
                                }`}>
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm">{validation.message}</p>
                            </div>
                        )}

                        {currentQ.id === 'session_duration' && validation.status === 'error' && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={() => setAnswers(prev => ({ ...prev, lowVolumeOverride: true }))}
                                    className="text-xs text-gray-500 hover:text-white underline transition-colors"
                                >
                                    Ignorer l'avertissement et continuer
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'body-map':
                // ... (existing body map)
                return (
                    <BodyMap
                        gender={answers['sex']?.startsWith('Femme') ? 'Femme' : 'Homme'}
                        selectedZones={val || []}
                        onToggleZone={(zone) => {
                            const current = val || [];
                            if (current.includes(zone)) setAnswer(current.filter((z: string) => z !== zone));
                            else setAnswer([...current, zone]);
                        }}
                    />
                );

            default:
                return null;
        }
    };



    if (!isLoaded || !currentQ) return <div className="min-h-screen flex items-center justify-center text-white bg-[#09090b]"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;

    const progress = ((currentStep + 1) / activeQuestions.length) * 100;

    return (
        <main className="min-h-screen bg-[#09090b] text-white flex flex-col relative overflow-hidden font-sans selection:bg-blue-500/30">
            {/* ProgressBar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 z-20">
                <div
                    className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
                    style={{ width: `${progress}%`, transition: 'width 0.5s ease-out' }}
                />
            </div>

            {/* Header */}
            <div className="p-6 md:p-8 flex justify-between items-center z-10">
                <button onClick={() => router.push('/')} className="p-3 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-all hover:rotate-90 duration-300">
                    <X className="w-6 h-6" />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <img src="/logo.png" className="w-20 h-20 object-contain mb-2 opacity-90 hover:scale-105 transition-transform" alt="Logo" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
                        Question {currentStep + 1}
                    </span>
                    <span className="text-sm font-bold text-gray-400">{currentQ.section}</span>
                </div>
                <div className="w-12" /> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-5xl mx-auto w-full z-10 animate-in fade-in slide-in-from-bottom-4 duration-500" key={currentQ.id}>
                <div className="text-center mb-6 md:mb-12">
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 tracking-tight leading-tight mb-4 drop-shadow-sm">
                        {currentQ.title}
                    </h1>
                    {currentQ.subtitle && (
                        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium">
                            {currentQ.subtitle}
                        </p>
                    )}
                </div>

                <div className="w-full">
                    {renderInput()}
                </div>
            </div>

            {/* Footer Controls */}
            <div className="p-8 md:pb-12 flex justify-between items-center z-10 max-w-5xl mx-auto w-full mt-auto">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="flex items-center gap-3 text-gray-500 hover:text-white disabled:opacity-0 font-bold uppercase text-xs tracking-widest transition-all group"
                >
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 group-hover:bg-white/5 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span>Retour</span>
                </button>

                {currentQ.type !== 'choice' && (
                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`group flex items-center gap-4 pl-8 pr-2 py-2 rounded-full font-bold text-sm uppercase tracking-wider hover:scale-105 transition-all shadow-xl shadow-white/10 ${canProceed ? 'bg-white text-black cursor-pointer' : 'bg-white/20 text-gray-400 cursor-not-allowed grayscale'
                            }`}
                    >
                        {currentStep === activeQuestions.length - 1 ? 'Terminer' : 'Suivant'}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${canProceed ? 'bg-black text-white group-hover:bg-blue-600' : 'bg-black/20 text-gray-500'
                            }`}>
                            <ChevronRight className="w-5 h-5" />
                        </div>
                    </button>
                )}
            </div>

            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[800px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>
        </main>
    );
}
