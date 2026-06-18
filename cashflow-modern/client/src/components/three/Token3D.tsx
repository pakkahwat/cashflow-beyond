import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines, Html } from '@react-three/drei';
import * as THREE from 'three';

export interface Token3DProps {
  targetIndex: number; // tile index on the ring (0-based)
  count: number; // tiles in the ring
  radius: number;
  dx: number; // small world offset so co-located tokens don't overlap
  dz: number;
  color: string;
  current: boolean;
  reducedMotion: boolean;
  name?: string;
  variant?: number; // selects one of several 3D character shapes
}

const BASE_Y = 0.52; // token rests on top of a normal tile
const ACTIVE_LIFT = 0.35; // matches Tile3D's active-tile lift so the current token rides the raised tile
const SPEED = 6; // tiles per second while walking

// The distinctive "head" on top of the pawn base — a different 3D shape per variant.
function TokenTop({ variant, color, current }: { variant: number; color: string; current: boolean }) {
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.26}
      metalness={0.5}
      emissive={current ? color : '#000000'}
      emissiveIntensity={current ? 0.55 : 0}
    />
  );
  const outline = current ? (
    <Outlines thickness={3} color="#ffd766" transparent opacity={0.9} />
  ) : null;
  const v = ((variant % 6) + 6) % 6;

  switch (v) {
    case 1: // cone / rocket
      return (
        <mesh castShadow position={[0, 0.43, 0]}>
          <coneGeometry args={[0.24, 0.44, 24]} />
          {material}
          {outline}
        </mesh>
      );
    case 2: // gem / diamond
      return (
        <mesh castShadow position={[0, 0.37, 0]} rotation={[0, Math.PI / 4, 0]}>
          <octahedronGeometry args={[0.3, 0]} />
          {material}
          {outline}
        </mesh>
      );
    case 3: // crystal
      return (
        <mesh castShadow position={[0, 0.37, 0]}>
          <icosahedronGeometry args={[0.28, 0]} />
          {material}
          {outline}
        </mesh>
      );
    case 4: // faceted ball
      return (
        <mesh castShadow position={[0, 0.37, 0]}>
          <dodecahedronGeometry args={[0.27, 0]} />
          {material}
          {outline}
        </mesh>
      );
    case 5: // capsule
      return (
        <mesh castShadow position={[0, 0.4, 0]}>
          <capsuleGeometry args={[0.18, 0.26, 8, 16]} />
          {material}
          {outline}
        </mesh>
      );
    default: // 0: classic sphere head
      return (
        <mesh castShadow position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.26, 24, 24]} />
          {material}
          {outline}
        </mesh>
      );
  }
}

export default function Token3D({
  targetIndex,
  count,
  radius,
  dx,
  dz,
  color,
  current,
  reducedMotion,
  name,
  variant = 0
}: Token3DProps) {
  const ref = useRef<THREE.Group>(null!);
  const curIdx = useRef(targetIndex); // fractional current tile index
  const inited = useRef(false);
  const baseY = current ? BASE_Y + ACTIVE_LIFT : BASE_Y; // sit on top of the (possibly lifted) tile

  const posAt = (i: number): [number, number] => {
    const a = -Math.PI / 2 + i * ((2 * Math.PI) / count);
    // spread co-located tokens along the tile tangent (dx) / radial (dz), not world X,
    // so they fan along the tile edge everywhere around the ring
    return [
      radius * Math.cos(a) - dx * Math.sin(a) + dz * Math.cos(a),
      radius * Math.sin(a) + dx * Math.cos(a) + dz * Math.sin(a)
    ];
  };

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    if (!inited.current || reducedMotion) {
      curIdx.current = targetIndex;
      const [x, z] = posAt(targetIndex);
      g.position.set(x, baseY, z);
      inited.current = true;
      return;
    }
    // Always walk FORWARD around the ring (wrap), stepping tile by tile.
    let diff = targetIndex - curIdx.current;
    while (diff < -0.0001) diff += count;
    if (diff > 0.02) {
      curIdx.current += Math.min(diff, delta * SPEED);
      if (curIdx.current >= count) curIdx.current -= count;
      const [x, z] = posAt(curIdx.current);
      g.position.x = x;
      g.position.z = z;
      g.position.y = baseY + Math.abs(Math.sin(curIdx.current * Math.PI)) * 0.35; // hop per tile
    } else {
      curIdx.current = targetIndex;
      const [x, z] = posAt(targetIndex);
      g.position.x = x;
      g.position.z = z;
      g.position.y = THREE.MathUtils.lerp(g.position.y, baseY, Math.min(1, delta * 8));
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.32, 0.2, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.4} />
      </mesh>
      <TokenTop variant={variant} color={color} current={current} />
      {name && (
        <Html
          position={[0, 1.05, 0]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="token-name">{name}</div>
        </Html>
      )}
    </group>
  );
}
