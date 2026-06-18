import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
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
}

const BASE_Y = 0.5;
const SPEED = 6; // tiles per second while walking

export default function Token3D({
  targetIndex,
  count,
  radius,
  dx,
  dz,
  color,
  current,
  reducedMotion
}: Token3DProps) {
  const ref = useRef<THREE.Group>(null!);
  const cur = useRef(targetIndex); // fractional current tile index
  const inited = useRef(false);

  const posAt = (i: number): [number, number] => {
    const a = -Math.PI / 2 + i * ((2 * Math.PI) / count);
    return [radius * Math.cos(a) + dx, radius * Math.sin(a) + dz];
  };

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    if (!inited.current || reducedMotion) {
      cur.current = targetIndex;
      const [x, z] = posAt(targetIndex);
      g.position.set(x, BASE_Y, z);
      inited.current = true;
      return;
    }
    // Always walk FORWARD around the ring (wrap), stepping tile by tile.
    let diff = targetIndex - cur.current;
    while (diff < -0.0001) diff += count;
    if (diff > 0.02) {
      cur.current += Math.min(diff, delta * SPEED);
      if (cur.current >= count) cur.current -= count;
      const [x, z] = posAt(cur.current);
      g.position.x = x;
      g.position.z = z;
      // hop: lands (y=BASE_Y) on each tile, peaks between tiles
      g.position.y = BASE_Y + Math.abs(Math.sin(cur.current * Math.PI)) * 0.35;
    } else {
      cur.current = targetIndex;
      const [x, z] = posAt(targetIndex);
      g.position.x = x;
      g.position.z = z;
      g.position.y = THREE.MathUtils.lerp(g.position.y, BASE_Y, Math.min(1, delta * 8));
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.18, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.35}
          emissive={current ? color : '#000000'}
          emissiveIntensity={current ? 0.6 : 0}
        />
        {current && <Outlines thickness={3} color="#ffd766" transparent opacity={0.9} />}
      </mesh>
    </group>
  );
}
