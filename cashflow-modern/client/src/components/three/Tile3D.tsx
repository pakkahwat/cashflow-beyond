import { RoundedBox, Html, Outlines } from '@react-three/drei';
import TileIcon from './TileIcon';

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
const TILE_H = 0.35;
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
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
        )}
        {active && <Outlines thickness={4} color="#ffd766" transparent opacity={0.9} />}
      </RoundedBox>
      <Html
        position={[0, TILE_H / 2 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        transform
        occlude
        distanceFactor={6}
        style={{ pointerEvents: 'none', textAlign: 'center', userSelect: 'none' }}
      >
        <TileIcon name={icon} />
        <div style={{ fontSize: 9, color: '#e8ecf8', fontWeight: 600, marginTop: 3 }}>{label}</div>
      </Html>
    </group>
  );
}
