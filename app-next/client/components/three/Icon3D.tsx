// Real 3D tile icons built from primitives + extruded shapes (no external assets).
// Mounted inside a <Billboard> by Tile3D so they always face the camera.
// Palette is intentionally soft & matte (no emissive) so the icons read cleanly
// and don't glow / over-saturate under Bloom.
import { useMemo } from 'react';
import * as THREE from 'three';

const LIGHT = '#d7deec'; // soft off-white
const GOLD = '#cbac63'; // muted gold
const extrudeOpts = { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 };

function makeHeart() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.bezierCurveTo(0, 0.08, -0.06, 0.2, -0.17, 0.2);
  s.bezierCurveTo(-0.32, 0.2, -0.32, 0.02, -0.32, 0.02);
  s.bezierCurveTo(-0.32, -0.12, -0.16, -0.24, 0, -0.34);
  s.bezierCurveTo(0.16, -0.24, 0.32, -0.12, 0.32, 0.02);
  s.bezierCurveTo(0.32, 0.02, 0.32, 0.2, 0.17, 0.2);
  s.bezierCurveTo(0.06, 0.2, 0, 0.08, 0, 0.08);
  return s;
}
function makeStar() {
  const s = new THREE.Shape();
  const spikes = 5, outer = 0.28, inner = 0.13;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  }
  s.closePath();
  return s;
}
function makeTriangle() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.26);
  s.lineTo(0.28, -0.22);
  s.lineTo(-0.28, -0.22);
  s.closePath();
  return s;
}

// soft, matte material — no emissive so nothing blooms or looks neon
function Std({ color = LIGHT }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.42} metalness={0.18} />;
}

export default function Icon3D({ name }: { name: string }) {
  const heart = useMemo(makeHeart, []);
  const star = useMemo(makeStar, []);
  const triangle = useMemo(makeTriangle, []);

  switch (name) {
    case 'charity':
      return (
        <mesh rotation={[0, 0, Math.PI]}>
          <extrudeGeometry args={[heart, extrudeOpts]} />
          <Std color="#d77f97" />
        </mesh>
      );
    case 'dream':
      return (
        <mesh>
          <extrudeGeometry args={[star, extrudeOpts]} />
          <Std color={GOLD} />
        </mesh>
      );
    case 'loss':
      return (
        <group>
          <mesh>
            <extrudeGeometry args={[triangle, extrudeOpts]} />
            <Std color="#cf8f73" />
          </mesh>
          <mesh position={[0, 0.02, 0.09]}>
            <boxGeometry args={[0.05, 0.16, 0.04]} />
            <Std color="#3a2420" />
          </mesh>
          <mesh position={[0, -0.12, 0.09]}>
            <boxGeometry args={[0.05, 0.05, 0.04]} />
            <Std color="#3a2420" />
          </mesh>
        </group>
      );
    case 'payday':
    case 'cashflowDay':
      // a small stack of gold coins
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          {[-0.06, 0, 0.06].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.05, 28]} />
              <Std color={GOLD} />
            </mesh>
          ))}
        </group>
      );
    case 'market':
    case 'downsized': {
      // ascending (market) / descending (downsized) bar chart
      const up = name === 'market';
      const hs = up ? [0.16, 0.26, 0.38] : [0.38, 0.26, 0.16];
      const color = up ? '#73c096' : '#cf8273';
      return (
        <group>
          {hs.map((h, i) => (
            <mesh key={i} position={[(i - 1) * 0.18, -0.2 + h / 2, 0]}>
              <boxGeometry args={[0.13, h, 0.1]} />
              <Std color={color} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'investment':
      // a little tower with window detail
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.34, 0.5, 0.18]} />
            <Std color="#c2cbe0" />
          </mesh>
          {[-0.1, 0.06].map((y) =>
            [-0.08, 0.08].map((x) => (
              <mesh key={`${x}-${y}`} position={[x, y, 0.1]}>
                <boxGeometry args={[0.06, 0.08, 0.02]} />
                <Std color="#9fa8c4" />
              </mesh>
            ))
          )}
        </group>
      );
    case 'doodad':
      // shopping bag
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.32, 0.34, 0.16]} />
            <Std color="#c79070" />
          </mesh>
          <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.02, 8, 20, Math.PI]} />
            <Std />
          </mesh>
        </group>
      );
    case 'baby':
      // a rounded baby block
      return (
        <mesh rotation={[0.3, 0.4, 0]}>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <Std color="#9ccdd8" />
        </mesh>
      );
    case 'deal':
    default:
      // briefcase
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.4, 0.28, 0.14]} />
            <Std color={LIGHT} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.022, 8, 20, Math.PI]} />
            <Std />
          </mesh>
          <mesh position={[0, 0, 0.075]}>
            <boxGeometry args={[0.4, 0.05, 0.01]} />
            <Std color="#8893bd" />
          </mesh>
        </group>
      );
  }
}
