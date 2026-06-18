import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import Lighting from './Lighting';
import Effects from './Effects';
import RatRaceRing3D from './RatRaceRing3D';
import FastTrackRing3D from './FastTrackRing3D';
import Dice3DGL from './Dice3DGL';
import RatRaceBoard from '../RatRaceBoard';
import type { GameState, Dream, FastTrackTile } from '../../lib/types';
import '../../styles/board3d.css';

export interface Board3DProps {
  state: GameState;
  myId: string;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  quality: 'high' | 'low';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Board3D({ state, myId, dreams, fastTrack, quality }: Board3DProps) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const me = state.players.find((p) => p.id === myId) ?? null;
  const isFastTrack = me?.phase === 'fastTrack';
  const highFx = quality === 'high' && !reducedMotion;

  // Render as many dice as were actually rolled (FT charity can roll 1–3).
  const diceCount = state.hasRolled
    ? Math.max(1, state.diceValues.length)
    : isFastTrack
      ? 2
      : 1;
  const diceValue = (i: number): number | null =>
    state.hasRolled ? state.diceValues[i] ?? null : null;

  return (
    <div className="board3d-canvas">
      <Canvas
        shadows={quality === 'high'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        camera={{ position: [0, 11, 11], fov: 42, near: 0.1, far: 100 }}
        gl={{
          antialias: !highFx, // SMAA handles AA when the composer is on
          toneMapping: highFx ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace
        }}
        fallback={
          <RatRaceBoard players={state.players} currentId={state.currentPlayerId} center={null} />
        }
      >
        <color attach="background" args={['#0b0f1d']} />
        <fog attach="fog" args={['#0b0f1d', 18, 40]} />
        <Lighting quality={quality} />

        {isFastTrack ? (
          <FastTrackRing3D
            players={state.players}
            currentId={state.currentPlayerId}
            tiles={fastTrack}
            dreams={dreams}
            quality={quality}
            reducedMotion={reducedMotion}
          />
        ) : (
          <RatRaceRing3D
            players={state.players}
            currentId={state.currentPlayerId}
            quality={quality}
            reducedMotion={reducedMotion}
          />
        )}

        {Array.from({ length: diceCount }).map((_, i) => (
          <Dice3DGL
            key={i}
            position={[(i - (diceCount - 1) / 2) * 1.1, 0.6, 0]}
            value={diceValue(i)}
            trigger={`${state.diceValues.join(',')}|${state.currentPlayerId}|${state.hasRolled}|${i}`}
            reducedMotion={reducedMotion}
          />
        ))}

        {quality === 'high' && (
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.55}
            scale={22}
            blur={2.2}
            far={6}
            resolution={512}
            color="#000000"
          />
        )}

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={9}
          maxDistance={20}
          target={[0, 0, 0]}
        />
        <Effects enabled={highFx} quality={quality} />
      </Canvas>
    </div>
  );
}
