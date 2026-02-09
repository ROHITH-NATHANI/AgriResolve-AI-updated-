import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RefreshCw, Droplets, Sprout, Wind, ThermometerSun, Activity, ChevronRight, Layers } from 'lucide-react';
import { AgriTwinEngine } from '../features/agritwin/engine';
import { SoilHealthCard, SimulationState, CROP_LIBRARY, CropType } from '../features/agritwin/types';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Environment, Sky, ContactShadows, PointerLockControls, Stars, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, TiltShift2, Noise } from '@react-three/postprocessing';

// --- 3D Components (Visuals) ---
// --- 3D Assets (Procedural) ---

// --- High Fidelity Rendering Components ---

// --- Multi-Layer Organic Rendering ---

const RainSystem: React.FC<{ count: number, active: boolean }> = ({ count, active }) => {
    const rainGeo = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 100;
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geo;
    }, [count]);

    const rainMat = useMemo(() => new THREE.PointsMaterial({
        color: 0xaaaaaa, size: 0.1, transparent: true, opacity: 0.8
    }), []);

    const ref = useRef<THREE.Points>(null);
    useFrame((_, delta) => {
        if (!ref.current || !active) return;
        const positions = ref.current.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < count * 3; i += 3) {
            positions[i] -= 20 * delta; // Fall speed
            if (positions[i] < 0) positions[i] = 50; // Reset height
        }
        ref.current.geometry.attributes.position.needsUpdate = true;
    });

    if (!active) return null;
    return <points ref={ref} geometry={rainGeo} material={rainMat} />;
};

const FieldInstanceRenderer: React.FC<{ state: SimulationState }> = ({ state }) => {
    // Refs for 3 Layers
    const stemRef = useRef<THREE.InstancedMesh>(null);
    const foliageRef = useRef<THREE.InstancedMesh>(null);
    const fruitRef = useRef<THREE.InstancedMesh>(null);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Dynamic Density based on Crop Type
    const { COUNT, GRID_SIZE } = useMemo(() => {
        const type = state.crop.type;
        // Rice/Wheat: Dense Field (4000 plants in 60m grid)
        if (type === 'RICE' || type === 'WHEAT') return { COUNT: 4000, GRID_SIZE: 60 };

        // Others: Maximum Spacing (400 plants in 120m grid = ~6m spacing)
        return { COUNT: 400, GRID_SIZE: 120 };
    }, [state.crop.type]);

    // --- Geometries for Layers ---
    const { stemGeo, foliageGeo, fruitGeo } = useMemo(() => {
        const type = state.crop.type;
        let sGeo, fGeo, frGeo;

        if (type === 'MAIZE') {
            sGeo = new THREE.CylinderGeometry(0.04, 0.08, 1, 6); sGeo.translate(0, 0.5, 0);
            fGeo = new THREE.PlaneGeometry(0.6, 0.15, 2, 2); fGeo.translate(0.3, 0.5, 0); // Leaf projecting out
            frGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3); frGeo.translate(0.1, 0.6, 0); // Corn cob
        } else if (type === 'COTTON') {
            sGeo = new THREE.CylinderGeometry(0.02, 0.03, 1, 5); sGeo.translate(0, 0.5, 0);
            fGeo = new THREE.SphereGeometry(0.3, 4, 4); fGeo.translate(0, 0.5, 0); // Bush body
            frGeo = new THREE.SphereGeometry(0.1, 4, 4); // Cotton boll
        } else if (type === 'CHILLI') {
            sGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.6, 5); sGeo.translate(0, 0.3, 0);
            fGeo = new THREE.SphereGeometry(0.3, 4, 4); fGeo.translate(0, 0.4, 0);
            frGeo = new THREE.ConeGeometry(0.03, 0.1, 4); frGeo.rotateX(Math.PI / 2); // Pepper
        } else { // Rice/Wheat
            sGeo = new THREE.BoxGeometry(0.02, 1, 0.02); sGeo.translate(0, 0.5, 0);
            fGeo = new THREE.BoxGeometry(0.02, 0.8, 0.02); fGeo.rotateZ(0.2); fGeo.translate(0.1, 0.4, 0); // Extra blade
            frGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04); frGeo.translate(0, 0.9, 0); // Head
        }
        return { stemGeo: sGeo, foliageGeo: fGeo, fruitGeo: frGeo };
    }, [state.crop.type]);

    useFrame((state_gl) => {
        const time = state_gl.clock.getElapsedTime();
        const crop = state.crop;

        let idx = 0;
        for (let x = 0; x < Math.sqrt(COUNT); x++) {
            for (let z = 0; z < Math.sqrt(COUNT); z++) {
                const xPos = (x / Math.sqrt(COUNT)) * GRID_SIZE - GRID_SIZE / 2;
                const zPos = (z / Math.sqrt(COUNT)) * GRID_SIZE - GRID_SIZE / 2;

                // Wind
                const wave = Math.sin(time * 1.5 + xPos * 0.3 + zPos * 0.3);
                const windForce = wave * 0.1 * (crop.height / 100);

                // --- STEM ---
                dummy.position.set(xPos, 0, zPos);
                dummy.rotation.set(windForce, (Math.random() - 0.5), windForce);
                const h = Math.max(0.1, crop.height / 20);
                dummy.scale.set(1, h, 1);
                dummy.updateMatrix();
                if (stemRef.current) stemRef.current.setMatrixAt(idx, dummy.matrix);

                // --- FOLIAGE (Leaves flutter more) ---
                dummy.rotation.set(windForce * 1.5, (Math.random() - 0.5), windForce * 1.5);
                // Foliage grows wider
                if (crop.type === 'COTTON' || crop.type === 'CHILLI') dummy.scale.set(h, h, h);
                else dummy.scale.set(1, h, 1);
                dummy.updateMatrix();
                if (foliageRef.current) foliageRef.current.setMatrixAt(idx, dummy.matrix);

                // --- FRUIT (Only if reproductive) ---
                if (crop.dvs > 1.0) {
                    dummy.rotation.set(windForce, (Math.random() - 0.5), windForce);
                    dummy.scale.set(1, 1, 1); // Fruits don't stretch like stems
                    dummy.updateMatrix();
                    if (fruitRef.current) fruitRef.current.setMatrixAt(idx, dummy.matrix);
                } else {
                    // Hide fruit if not ready
                    dummy.scale.set(0, 0, 0);
                    dummy.updateMatrix();
                    if (fruitRef.current) fruitRef.current.setMatrixAt(idx, dummy.matrix);
                }
                idx++;
            }
        }
        if (stemRef.current) stemRef.current.instanceMatrix.needsUpdate = true;
        if (foliageRef.current) foliageRef.current.instanceMatrix.needsUpdate = true;
        if (fruitRef.current) fruitRef.current.instanceMatrix.needsUpdate = true;

        // Color Updates
        const baseColor = new THREE.Color("#4caf50"); // Stem Green
        const foliageColor = new THREE.Color("#66bb6a"); // Leaf lighter
        const fruitColor = new THREE.Color("#ffffff");

        if (crop.type === 'COTTON' && crop.dvs > 1.2) fruitColor.set("#ffffff");
        if (crop.type === 'CHILLI' && crop.dvs > 1.2) fruitColor.set("#d32f2f");
        if (crop.type === 'WHEAT' && crop.dvs > 1.2) { baseColor.set("#eecfa1"); foliageColor.set("#dce775"); fruitColor.set("#ffecb3"); }

        if (state.stress.water > 0.4) {
            baseColor.lerp(new THREE.Color("#8d6e63"), 0.6);
            foliageColor.lerp(new THREE.Color("#8d6e63"), 0.8); // Leaves die first
        }

        if (stemRef.current && stemRef.current.material instanceof THREE.MeshStandardMaterial) stemRef.current.material.color = baseColor;
        if (foliageRef.current && foliageRef.current.material instanceof THREE.MeshStandardMaterial) foliageRef.current.material.color = foliageColor;
        if (fruitRef.current && fruitRef.current.material instanceof THREE.MeshStandardMaterial) fruitRef.current.material.color = fruitColor;
    });

    const isRaining = state.weather.rain > 5;

    return (
        <group>
            {/* Dynamic Environment */}
            <Sky
                sunPosition={[100, 20 + Math.sin(state.day * 0.1) * 20, 100]} // Sun moves nicely
                turbidity={isRaining ? 20 : 10}
                rayleigh={isRaining ? 0.5 : 2}
            />
            <Stars fade />
            <Cloud position={[0, 20, 0]} opacity={isRaining ? 0.9 : 0.3} speed={0.2} color={isRaining ? "#444" : "#fff"} />
            <fogExp2 attach="fog" args={[isRaining ? '#111' : '#1a1a1a', isRaining ? 0.05 : 0.02]} />

            <RainSystem count={2000} active={isRaining} />

            <ambientLight intensity={isRaining ? 0.1 : 0.3} />
            <directionalLight
                position={[50, 50, 25]}
                intensity={isRaining ? 0.5 : 2}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />

            {/* Texture Ground - Infinite Look */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[1000, 1000, 32, 32]} />
                <meshStandardMaterial color={isRaining ? "#281912" : "#3e2723"} roughness={0.9} />
            </mesh>

            <instancedMesh ref={stemRef} args={[stemGeo, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial />
            </instancedMesh>
            <instancedMesh ref={foliageRef} args={[foliageGeo, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial side={THREE.DoubleSide} />
            </instancedMesh>
            <instancedMesh ref={fruitRef} args={[fruitGeo, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial />
            </instancedMesh>
        </group>
    );
};

// --- SCout Mode (WASD Movement) ---
const ScoutCamera: React.FC = () => {
    const { camera } = useThree();
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp': case 'KeyW': moveForward.current = true; break;
                case 'ArrowLeft': case 'KeyA': moveLeft.current = true; break;
                case 'ArrowDown': case 'KeyS': moveBackward.current = true; break;
                case 'ArrowRight': case 'KeyD': moveRight.current = true; break;
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp': case 'KeyW': moveForward.current = false; break;
                case 'ArrowLeft': case 'KeyA': moveLeft.current = false; break;
                case 'ArrowDown': case 'KeyS': moveBackward.current = false; break;
                case 'ArrowRight': case 'KeyD': moveRight.current = false; break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useFrame((_, delta) => {
        if (!moveForward.current && !moveBackward.current && !moveLeft.current && !moveRight.current) return;

        // Speed settings
        const speed = 10.0 * delta;

        direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
        direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
        direction.current.normalize(); // consistent speed in all directions

        if (moveForward.current || moveBackward.current) camera.translateZ(direction.current.z * speed);
        if (moveLeft.current || moveRight.current) camera.translateX(direction.current.x * speed);

        // Keep height fixed (Walk on ground)
        camera.position.y = 1.7;
    });

    return <PointerLockControls />;
};

const CameraController: React.FC<{ mode: 'ORBIT' | 'SCOUT' }> = ({ mode }) => {
    const { camera } = useThree();

    useEffect(() => {
        if (mode === 'SCOUT') {
            camera.position.set(0, 1.7, 5); // Start at edge
            camera.lookAt(0, 1.7, 0);
        } else {
            camera.position.set(20, 20, 20);
            camera.lookAt(0, 0, 0);
        }
    }, [mode, camera]);

    return mode === 'ORBIT' ?
        <OrbitControls enableDamping dampingFactor={0.05} /> :
        <ScoutCamera />;
};

// --- Main Interface ---
export const Simulator: React.FC = () => {
    const { t } = useTranslation();
    // Setup (Mock SHC for now - usually passed from user profile)
    const [shc] = useState<SoilHealthCard>({
        id: "demo-1", N: 280, P: 22, K: 150, pH: 7.2, EC: 0.5, OC: 0.6
    });

    const [engine, setEngine] = useState<AgriTwinEngine>(new AgriTwinEngine(shc, 'RICE'));
    const [simState, setSimState] = useState<SimulationState>(engine.state);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedCrop, setSelectedCrop] = useState<CropType>('RICE');
    const [cameraMode, setCameraMode] = useState<'ORBIT' | 'SCOUT'>('ORBIT');
    // Mobile Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Auto-Run Effect
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                const newState = engine.nextDay({});
                setSimState(newState);
                if (newState.crop.dvs >= 2.0 || newState.crop.health <= 0) setIsPlaying(false);
            }, 500); // Slower day cycle for weather observation
        }
        return () => clearInterval(interval);
    }, [isPlaying, engine]);

    const handleAction = (type: 'IRRIGATE' | 'FERTILIZE' | 'WEED' | 'HARVEST') => {
        const newState = engine.nextDay(
            type === 'IRRIGATE' ? { irrigate: 20 } :
                type === 'FERTILIZE' ? { fertilize_n: 15 } :
                    type === 'WEED' ? { weed: true } :
                        { harvest: true, newCrop: selectedCrop === 'RICE' ? 'WHEAT' : 'RICE' } // Toggles for demo
        );

        // Auto switch selected crop if harvested
        if (type === 'HARVEST') {
            setSelectedCrop(selectedCrop === 'RICE' ? 'WHEAT' : 'RICE');
            setIsPlaying(false); // Pause after harvest
        }

        setSimState(newState);
    };

    const reset = () => {
        const newEngine = new AgriTwinEngine(shc, selectedCrop);
        setEngine(newEngine);
        setSimState(newEngine.state);
        setIsPlaying(false);
    };

    return (
        <div className="h-[100dvh] bg-neutral-900 text-white overflow-hidden flex flex-col md:flex-row font-sans relative">
            {/* Mobile Header / Toggle */}
            <div className="md:hidden bg-neutral-800 border-b border-white/10 p-4 flex justify-between items-center z-20 shrink-0">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-lg tracking-tight">Agri-Twin</span>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 rounded-lg transition-colors ${isSidebarOpen ? 'bg-white/10 text-white' : 'text-neutral-400'}`}
                >
                    <Layers className="w-5 h-5" />
                </button>
            </div>

            {/* Sidebar / Configuration */}
            <div className={`
                absolute md:relative inset-0 z-30 md:z-auto bg-neutral-900/95 md:bg-neutral-800/50 backdrop-blur-xl md:backdrop-blur-none 
                border-r border-white/10 p-6 flex-col gap-6 transition-transform duration-300 ease-in-out md:translate-x-0 md:flex md:w-80
                ${isSidebarOpen ? 'flex translate-x-0' : 'hidden md:flex -translate-x-full'}
            `}>
                <div className="hidden md:block">
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                        <Activity className="w-6 h-6 text-emerald-400" /> {t('sim_title', 'Agri-Twin')}
                    </h1>
                    <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">Cyber-Physical Simulator</p>
                </div>

                {/* Mobile Close Button */}
                <button
                    className="md:hidden absolute top-4 right-4 p-2 text-neutral-400"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    <ChevronRight className="w-6 h-6 rotate-180" />
                </button>

                {/* Crop Selector */}
                <div className="space-y-2 mt-8 md:mt-0">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Crop Model</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CROP_LIBRARY) as CropType[]).map(c => (
                            <button
                                key={c}
                                onClick={() => { setSelectedCrop(c); const e = new AgriTwinEngine(shc, c); setEngine(e); setSimState(e.state); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                                className={`p-2 rounded-lg text-xs font-bold transition-all border ${selectedCrop === c
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : 'bg-neutral-800 border-white/5 text-neutral-400 hover:bg-white/5'}`}
                            >
                                {CROP_LIBRARY[c].name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Soil Health Stats */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center text-xs text-neutral-400 uppercase font-bold">
                        <span>Soil Health</span>
                        <Layers className="w-4 h-4" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-black/20 p-2 rounded">
                            <div className="text-xs text-neutral-500">N</div>
                            <div className="font-mono text-emerald-400">{Math.floor(simState.soil.n_pool)}</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded">
                            <div className="text-xs text-neutral-500">P</div>
                            <div className="font-mono text-cyan-400">{shc.P}</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded">
                            <div className="text-xs text-neutral-500">K</div>
                            <div className="font-mono text-purple-400">{shc.K}</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-auto space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleAction('IRRIGATE')} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                            <Droplets className="w-5 h-5" />
                            <span className="font-bold text-sm">{t('sim_irrigate', 'Irrigate')}</span>
                        </button>
                        <button onClick={() => handleAction('FERTILIZE')} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                            <Sprout className="w-5 h-5" />
                            <span className="font-bold text-sm">{t('sim_fertilize', 'Fertilize')}</span>
                        </button>
                        <button onClick={() => handleAction('WEED')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                            <Wind className="w-5 h-5" />
                            <span className="font-bold text-sm">De-Weed</span>
                        </button>
                        <button onClick={() => handleAction('HARVEST')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                            <ChevronRight className="w-5 h-5" />
                            <span className="font-bold text-sm">Harvest (Rotate)</span>
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-black transition-all active:scale-95 ${isPlaying ? 'bg-amber-400 hover:bg-amber-500' : 'bg-emerald-400 hover:bg-emerald-500'}`}
                        >
                            {isPlaying ? <Pause className="fill-current w-4 h-4" /> : <Play className="fill-current w-4 h-4" />}
                            {isPlaying ? "Pause" : "Start"}
                        </button>
                        <button onClick={reset} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95">
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Camera Modes */}
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => { setCameraMode('ORBIT'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold ${cameraMode === 'ORBIT' ? 'bg-white text-black' : 'bg-white/5 text-neutral-400'}`}
                        >
                            GOD VIEW
                        </button>
                        <button
                            onClick={() => { setCameraMode('SCOUT'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold ${cameraMode === 'SCOUT' ? 'bg-white text-black' : 'bg-white/5 text-neutral-400'}`}
                        >
                            SCOUT VIEW
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stage (3D) */}
            <div className="flex-1 relative bg-black h-full">
                {/* HUD Overlay */}
                <div className="absolute top-4 md:top-6 left-4 right-4 md:left-6 md:right-6 flex flex-col md:flex-row justify-between items-start pointer-events-none z-10 gap-3">
                    <div className="flex gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                        <div className="bg-black/40 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 text-white min-w-[100px] md:min-w-0">
                            <div className="text-[10px] md:text-xs text-neutral-400 uppercase font-bold">Crop Age</div>
                            <div className="text-2xl md:text-3xl font-black font-mono">{simState.day} <span className="text-xs md:text-sm text-neutral-500 font-sans">{t('sim_days', 'Days')}</span></div>
                            <div className="text-[10px] md:text-xs text-emerald-400 mt-1 truncate">Stage: {simState.crop.dvs < 0.2 ? 'Seedling' : (simState.crop.dvs < 1 ? 'Vegetative' : 'Reproductive')}</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 text-white min-w-[120px] md:min-w-0">
                            <div className="text-[10px] md:text-xs text-neutral-400 uppercase font-bold">Yield Forecast</div>
                            <div className="text-2xl md:text-3xl font-black font-mono text-cyan-400">{Math.floor(simState.yield_forecast)} <span className="text-xs md:text-sm text-neutral-500 font-sans">kg/ha</span></div>
                        </div>
                        {simState.crop.weed_density > 0.1 && (
                            <div className="bg-red-900/40 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-red-500/30 text-white animate-pulse min-w-[120px] md:min-w-0">
                                <div className="text-[10px] md:text-xs text-red-300 uppercase font-bold">Weed Infestation</div>
                                <div className="text-xl md:text-2xl font-black font-mono text-red-400">{Math.floor(simState.crop.weed_density * 100)}%</div>
                                <div className="text-[10px] md:text-xs text-red-300 mt-1">Competition High</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-black/40 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10 text-white w-full md:w-auto md:min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2 text-[10px] md:text-xs text-neutral-400 uppercase font-bold">
                            <ThermometerSun className="w-4 h-4" /> Environment
                        </div>
                        <div className="flex md:block gap-4 md:gap-0 font-mono text-sm">
                            <div className="flex justify-between flex-1 md:flex-none">
                                <span className="text-neutral-500 md:text-white">Temp</span>
                                <span>{Math.floor(simState.weather.temp_max)}°C</span>
                            </div>
                            <div className="flex justify-between flex-1 md:flex-none">
                                <span className="text-neutral-500 md:text-white">Humidity</span>
                                <span>{simState.weather.rain > 0 ? '90%' : '45%'}</span>
                            </div>
                            <div className="flex justify-between flex-1 md:flex-none">
                                <span className="text-neutral-500 md:text-white">Rain</span>
                                <span>{Math.floor(simState.weather.rain)}mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls Hint - Hidden on mobile to save space or reduced */}
                <div className="hidden md:block absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded text-xs mt-2 text-center pointer-events-auto z-0">
                    <b>SCOUT MODE:</b> Click to Focus • WASD to Move • ESC to Exit
                </div>


                {/* 3D Canvas */}
                <div className="w-full h-full">
                    <Canvas shadows camera={{ position: [20, 20, 20], fov: 50 }}>
                        <CameraController mode={cameraMode} />
                        <Environment preset="forest" background blur={0.6} />
                        <FieldInstanceRenderer state={simState} />
                        <EffectComposer>
                            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
                            <Vignette eskil={false} offset={0.1} darkness={1.1} />
                            <TiltShift2 blur={0.2} />
                            <Noise opacity={0.02} />
                        </EffectComposer>
                    </Canvas>
                </div>

                {/* Log Overlay - Bottom padding for mobile nav */}
                <div className="absolute bottom-24 md:bottom-6 left-4 right-4 md:left-6 md:right-6 pointer-events-none">
                    <div className="max-w-xl bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 text-xs font-mono max-h-24 md:max-h-32 overflow-hidden text-neutral-300">
                        {simState.event_log.slice(0, 3).map((log, i) => (
                            <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0 truncate">
                                <span className="text-emerald-500 mr-2">➜</span> {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div >
        </div >
    );
};
