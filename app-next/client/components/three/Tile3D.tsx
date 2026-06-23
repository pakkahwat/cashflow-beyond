import { RoundedBox, Html, Outlines, Billboard } from '@react-three/drei';
import Icon3D from './Icon3D';

export interface Tile3DProps {
  position: [number, number, number];
  rotationY: number;
  color: string;
  icon: string;
  label: string;
  active: boolean;
  quality: 'high' | 'low';
}

const TILE_W = 1.6;
const TILE_H = 0.42;
const TILE_D = 1.15;

export default function Tile3D({
  position,
  rotationY,
  color,
  icon,
  label,
  active,
  quality
}: Tile3DProps) {
  const [x, y, z] = position;
  const lift = active ? 0.35 : 0;
  return (
    <group position={[x, y + lift, z]} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[TILE_W, TILE_H, TILE_D]}
        radius={0.08}
        smoothness={4}
        castShadow={quality === 'high'}
        receiveShadow={quality === 'high'}
      >
        {active ? (
          <meshPhysicalMaterial
            color={color}
            roughness={0.3}
            metalness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.18}
            emissive={color}
            emissiveIntensity={0.85}
          />
        ) : (
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.28} />
        )}
        {active && <Outlines thickness={4} color="#ffd766" transparent opacity={0.9} />}
      </RoundedBox>
      {/* Real 3D icon, billboarded so it always faces the camera (upright on every tile). */}
      <Billboard position={[0, TILE_H / 2 + 0.34, 0]}>
        <group scale={0.7}>
          <Icon3D name={icon} />
        </group>
      </Billboard>
      {/* text label hugging the tile surface */}
      <Html
        position={[0, TILE_H / 2 + 0.02, 0]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none', textAlign: 'center', userSelect: 'none', width: 80 }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#eef2ff',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0,0,0,0.85)'
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
