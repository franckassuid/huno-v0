'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations, Environment, Center } from '@react-three/drei';

// --- MOCK TRAINING DATA ---
// Updated with new exercises based on available assets
const TRAINING_SESSION = {
    id: 'full_body_intensity',
    title: 'Full Body Intensity',
    duration: '20 min',
    difficulty: 'Intermédiaire',
    exercises: [
        {
            id: 'pushups',
            name: 'Pompes Classiques',
            duration: 60, // seconds
            video: '/assets/3d/pushup.glb',
            description: 'Maintenez le corps droit, descendez la poitrine au sol.',
            target: 'Pectoraux, Triceps',
            modelScale: 1.5,
            modelPosition: [0, -0.5, 0]
        },
        {
            id: 'squats',
            name: 'Air Squats',
            duration: 60,
            video: '/assets/3d/Air_Squat.glb',
            description: 'Pieds largeur d\'épaules, descendez les fesses en arrière en gardant le dos droit.',
            target: 'Quadriceps, Fessiers',
            modelScale: 1.6,
            modelPosition: [0, -2.5, 0]
        },
        {
            id: 'pike_walk',
            name: 'Pike Walk',
            duration: 60,
            video: '/assets/3d/Pike_Walk.glb',
            description: 'Avancez avec les mains jusqu\'en planche, puis revenez en position debout.',
            target: 'Épaules, Ischios, Core',
            modelScale: 0.8, // Smaller scale for large movement
            modelPosition: [0, -1, 0]
        },
        {
            id: 'plank',
            name: 'Gainage Frontal',
            duration: 60,
            video: '/assets/3d/Plank.glb',
            description: 'Contractez les abdos, ne cambrez pas le dos. Restez statique.',
            target: 'Abdominaux',
            modelScale: 1.5,
            modelPosition: [0, -0.5, 0]
        }
    ]
};

// --- 3D MODEL COMPONENT ---
function ModelViewer({ path, isPaused, scale = 1.2, position = [0, 0, 0] }: { path: string, isPaused: boolean, scale?: number, position?: number[] }) {
    const { scene, animations } = useGLTF(path, true);
    const { actions } = useAnimations(animations, scene);

    useEffect(() => {
        if (actions && animations.length > 0) {
            const actionName = Object.keys(actions)[0];
            const action = actions[actionName];
            if (action) {
                if (!isPaused) {
                    action.reset().fadeIn(0.5).play();
                    action.paused = false;
                } else {
                    action.paused = true;
                }
            }
        }
    }, [actions, animations, isPaused]);

    return (
        <>
            <ambientLight intensity={1.0} />
            <spotLight position={[10, 10, 10]} angle={0.25} penumbra={1} intensity={1} />
            <pointLight position={[-10, 5, 5]} intensity={0.5} />

            <Center position={position as [number, number, number]}>
                <primitive
                    object={scene}
                    scale={scale}
                    rotation={[0, Math.PI / 4, 0]}
                />
            </Center>

            <OrbitControls
                enableZoom={true}
                enablePan={false}
                autoRotate={!isPaused}
                autoRotateSpeed={2}
                minPolarAngle={Math.PI / 2}
                maxPolarAngle={Math.PI / 2}
                minDistance={2}
                maxDistance={6}
            />
            <Environment preset="city" />
        </>
    );
}

// Preload assets for smoother transitions
useGLTF.preload('/assets/3d/pushup.glb');
useGLTF.preload('/assets/3d/Air_Squat.glb');
useGLTF.preload('/assets/3d/Pike_Walk.glb');
useGLTF.preload('/assets/3d/Plank.glb');

// --- MAIN PAGE COMPONENT ---
export default function TrainingPage() {
    const router = useRouter();

    const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TRAINING_SESSION.exercises[0].duration);
    const [isActive, setIsActive] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const currentExercise = TRAINING_SESSION.exercises[currentExerciseIdx];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    useEffect(() => {
        if (timeLeft === 0 && isActive) {
            handleNextExercise();
        }
    }, [timeLeft, isActive]);

    const handleNextExercise = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsActive(false);

        if (currentExerciseIdx < TRAINING_SESSION.exercises.length - 1) {
            const nextIdx = currentExerciseIdx + 1;
            setCurrentExerciseIdx(nextIdx);
            setTimeLeft(TRAINING_SESSION.exercises[nextIdx].duration);
            // Auto-start next
            setIsActive(true);
        } else {
            setIsFinished(true);
        }
    };

    const handlePreviousExercise = () => {
        if (currentExerciseIdx > 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            const prevIdx = currentExerciseIdx - 1;
            setCurrentExerciseIdx(prevIdx);
            setTimeLeft(TRAINING_SESSION.exercises[prevIdx].duration);
            setIsActive(false);
        }
    };

    const togglePlay = () => setIsActive(!isActive);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const currentProgress = ((currentExercise.duration - timeLeft) / currentExercise.duration) * 100;

    if (isFinished) {
        return (
            <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-zinc-950 to-zinc-950">
                <div className="relative z-10 glass-card max-w-md w-full text-center p-8 animate-in zoom-in duration-500 border border-green-500/20 ring-1 ring-green-500/10">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-5px_rgba(34,197,94,0.3)] animate-bounce">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Séance terminée</h1>
                    <p className="text-zinc-400 mb-8">Bravo ! Vous avez complété votre session.</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                            <span className="block text-3xl font-bold text-white mb-1">{TRAINING_SESSION.duration.replace(' min', '')}</span>
                            <span className="text-xs text-zinc-500 uppercase font-medium tracking-wider">Minutes</span>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                            <span className="block text-3xl font-bold text-white mb-1">{TRAINING_SESSION.exercises.length}</span>
                            <span className="text-xs text-zinc-500 uppercase font-medium tracking-wider">Exercices</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => router.push('/')}
                            className="bg-white text-black hover:bg-zinc-200 w-full py-4 rounded-xl font-bold transition-all active:scale-[0.98]"
                        >
                            Retour à l'accueil
                        </button>
                        <button
                            onClick={() => {
                                setIsFinished(false);
                                setCurrentExerciseIdx(0);
                                setTimeLeft(TRAINING_SESSION.exercises[0].duration);
                                setIsActive(false);
                            }}
                            className="text-zinc-400 hover:text-white w-full py-3 text-sm font-medium transition-colors"
                        >
                            Recommencer la séance
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-between p-4 relative overflow-hidden text-white font-sans">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

            {/* HEADER */}
            <header className="w-full max-w-md mx-auto flex items-center justify-between z-20 pt-2 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all backdrop-blur-md"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">{TRAINING_SESSION.difficulty}</h2>
                    <div className="text-sm font-medium text-zinc-300">
                        Exo {currentExerciseIdx + 1} <span className="text-zinc-600">/</span> {TRAINING_SESSION.exercises.length}
                    </div>
                </div>

                <div className="w-10 h-10" /> {/* Spacer for balance */}
            </header>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[600px] relative z-10 my-2">

                {/* 3D VIEWER CONTAINER - INCREASED SIZE */}
                <div className="relative w-[85vw] h-[85vw] max-w-[420px] max-h-[420px] sm:max-w-[500px] sm:max-h-[500px] mb-6">
                    {/* Ring SVG */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-[0_0_50px_rgba(37,99,235,0.15)]">
                        <circle
                            cx="50%" cy="50%" r="49%"
                            stroke="#18181b"
                            strokeWidth="3"
                            fill="none"
                        />
                        <circle
                            cx="50%" cy="50%" r="49%"
                            stroke={isActive ? "#3b82f6" : "#52525b"}
                            strokeWidth="3"
                            fill="none"
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                            strokeDasharray="100 100"
                            pathLength="100"
                            style={{
                                strokeDashoffset: 100 - currentProgress,
                            }}
                        />
                    </svg>


                    {/* Inner Video Circle - REDUCED INSET */}
                    <div className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/50 shadow-inner overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.8)_100%)] pointer-events-none z-10" />
                        <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
                            {/* Pass dynamic scale from exercise data */}
                            <ModelViewer
                                key={currentExercise.id}
                                path={currentExercise.video}
                                isPaused={!isActive}
                                scale={currentExercise.modelScale || 1.3}
                                position={currentExercise.modelPosition}
                            />
                        </Canvas>
                    </div>
                </div>

                {/* INFO & TIMER */}
                <div className="text-center space-y-2 animate-in slide-in-from-bottom-5 fade-in duration-500">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                            {currentExercise.name}
                        </h1>
                        <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium bg-zinc-900/50 inline-block px-3 py-1 rounded-full border border-zinc-800/50">
                            {currentExercise.target}
                        </p>
                    </div>

                    <div className="py-1">
                        <span className="text-6xl sm:text-7xl font-bold tracking-tighter tabular-nums text-white drop-shadow-xl font-mono">
                            {formatTime(timeLeft)}
                        </span>
                    </div>

                    <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed h-10 line-clamp-2 px-4">
                        {currentExercise.description}
                    </p>
                </div>
            </div>

            {/* BOTTOM CONTROLS */}
            <div className="w-full max-w-md grid grid-cols-3 gap-4 z-20 pb-6 shrink-0">
                <button
                    onClick={handlePreviousExercise}
                    disabled={currentExerciseIdx === 0}
                    className="flex flex-col items-center justify-center gap-1 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400 active:scale-95 transition-all turned-off:opacity-30 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                    <RotateCcw className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Précédent</span>
                </button>

                <button
                    onClick={togglePlay}
                    className={`flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border active:scale-95 transition-all shadow-[0_0_30px_-5px_rgba(0,0,0,0.3)]
                        ${isActive
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
                            : 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20 hover:bg-blue-500 hover:shadow-blue-500/40'
                        }`}
                >
                    {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </button>

                <button
                    onClick={handleNextExercise}
                    disabled={currentExerciseIdx === TRAINING_SESSION.exercises.length - 1}
                    className="flex flex-col items-center justify-center gap-1 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-400 active:scale-95 transition-all turned-off:opacity-30 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                    <ChevronRight className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Suivant</span>
                </button>
            </div>
        </main>
    );
}
