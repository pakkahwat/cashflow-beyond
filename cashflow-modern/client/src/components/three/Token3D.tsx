import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';

export interface Token3DProps {
  target: [number, number, number];
  color: string;
  current: boolean;
  reducedMotion: boolean;
}

const BASE_Y = 0.45; // sits on top of the tiles

export default function Token3D({ target, color, current, reducedMotion }: Token3DProps) {
  const ref = useRef<THREE.Group>(null!);
  const t = useRef(0);
  const inited = useRef(false);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const [tx, , tz] = target;
    // First frame (or reduced motion): snap to the target, no animation.
    if (!inited.current || reducedMotion) {
      g.position.set(tx, BASE_Y, tz);
      inited.current = true;
      return;
    }
    const dist = Math.hypot(tx - g.position.x, tz - g.position.z);
    // lerp horizontally toward the target
    g.position.x = THREE.MathUtils.lerp(g.position.x, tx, Math.min(1, delta * 6));
    g.position.z = THREE.MathUtils.lerp(g.position.z, tz, Math.min(1, delta * 6));
    // hop while travelling, settle to BASE_Y when arrived
    if (dist > 0.05) {
      t.current += delta * 8;
      g.position.y = BASE_Y + Math.abs(Math.sin(t.current)) * 0.4;
    } else {
      t.current = 0;
      g.position.y = THREE.MathUtils.lerp(g.position.y, BASE_Y, Math.min(1, delta * 8));
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0, 0]}>
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
