import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export interface Dice3DGLProps {
  position: [number, number, number];
  value: number | null;
  trigger: string;
  reducedMotion: boolean;
}

const SIZE = 0.8;
const HALF = SIZE / 2;
const PIP_COLOR = '#1b1b24';
const D = 0.17; // pip grid spacing

// which of the 9 cells (row-major, row 0 = top) are lit for each value
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8]
};

// face transforms placing a local XY pip-plane on each cube side (facing out).
// Opposite faces sum to 7: top=1/bottom=6, front=2/back=5, right=3/left=4.
const FACES: { value: number; pos: [number, number, number]; rot: [number, number, number] }[] = [
  { value: 1, pos: [0, HALF, 0], rot: [-Math.PI / 2, 0, 0] },
  { value: 6, pos: [0, -HALF, 0], rot: [Math.PI / 2, 0, 0] },
  { value: 2, pos: [0, 0, HALF], rot: [0, 0, 0] },
  { value: 5, pos: [0, 0, -HALF], rot: [0, Math.PI, 0] },
  { value: 3, pos: [HALF, 0, 0], rot: [0, Math.PI / 2, 0] },
  { value: 4, pos: [-HALF, 0, 0], rot: [0, -Math.PI / 2, 0] }
];

// rotation that brings each value's face to the top (+Y), toward the camera
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0]
};

function Pip({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={[x, y, 0.008]} scale={[1, 1, 0.45]}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial color={PIP_COLOR} roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

function Face({
  value,
  pos,
  rot
}: {
  value: number;
  pos: [number, number, number];
  rot: [number, number, number];
}) {
  const cells = PIPS[value] ?? [];
  return (
    <group position={pos} rotation={rot}>
      {cells.map((c) => {
        const col = c % 3;
        const row = Math.floor(c / 3);
        return <Pip key={c} x={(col - 1) * D} y={(1 - row) * D} />;
      })}
    </group>
  );
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export default function Dice3DGL({ position, value, trigger, reducedMotion }: Dice3DGLProps) {
  const ref = useRef<THREE.Group>(null!);
  const spin = useRef(0); // remaining tumble time (seconds)

  useEffect(() => {
    if (value == null) return;
    spin.current = reducedMotion ? 0 : 0.85;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const v = value ?? 1;
    const [rx, ry, rz] = FACE_UP[v];
    if (spin.current > 0) {
      // tumble
      spin.current -= delta;
      g.rotation.x += delta * 11;
      g.rotation.y += delta * 8;
      g.rotation.z += delta * 6;
    } else {
      // settle: slerp toward the orientation that puts value `v` on top
      _q.setFromEuler(_e.set(rx, ry, rz));
      g.quaternion.slerp(_q, reducedMotion ? 1 : Math.min(1, delta * 9));
    }
  });

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[SIZE, SIZE, SIZE]} radius={0.12} smoothness={6} castShadow receiveShadow>
        <meshPhysicalMaterial color="#f7f4ea" roughness={0.35} metalness={0.05} clearcoat={1} clearcoatRoughness={0.15} />
      </RoundedBox>
      {FACES.map((f) => (
        <Face key={f.value} value={f.value} pos={f.pos} rot={f.rot} />
      ))}
    </group>
  );
}
