import { useTranslation } from 'react-i18next';
import { ratTileType, tileLabel } from '../../lib/boardLayout';
import { ringPositions, ratTileColor, tokenSlotOffset } from '../../lib/boardLayout3d';
import type { PublicPlayer } from '../../lib/types';
import Tile3D from './Tile3D';
import Token3D from './Token3D';

export interface RatRaceRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

const TILE_COUNT = 24;
const RAT_RADIUS = 6.2;

export default function RatRaceRing3D({
  players,
  currentId,
  quality,
  reducedMotion
}: RatRaceRing3DProps) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const ring = ringPositions(TILE_COUNT, RAT_RADIUS);

  const ratPlayers = players.filter((p) => p.phase === 'ratRace' && !p.isBankrupt);
  const tokensByPos: Record<number, PublicPlayer[]> = {};
  ratPlayers.forEach((p) => {
    const pos = p.position === 0 ? 24 : p.position;
    (tokensByPos[pos] ||= []).push(p);
  });

  return (
    <group>
      {/* board disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow={quality === 'high'}>
        <circleGeometry args={[RAT_RADIUS + 1.4, 64]} />
        <meshStandardMaterial color="#15203c" roughness={0.45} metalness={0.55} />
      </mesh>

      {ring.map((pt, idx) => {
        const position = idx + 1; // 1..24
        const type = ratTileType(position);
        const label = tileLabel[type];
        const tokens = tokensByPos[position] || [];
        const isActiveTile = tokens.some((tk) => tk.id === currentId);
        const rotationY = -pt.angle + Math.PI / 2;
        return (
          <Tile3D
            key={idx}
            position={[pt.x, 0.18, pt.z]}
            rotationY={rotationY}
            color={ratTileColor(position)}
            icon={type}
            label={label[lng]}
            active={isActiveTile}
            quality={quality}
          />
        );
      })}

      {ring.map((pt, idx) => {
        const position = idx + 1;
        const tokens = tokensByPos[position] || [];
        return tokens.map((p, i) => {
          const { dx, dz } = tokenSlotOffset(i, tokens.length, 0.45);
          return (
            <Token3D
              key={p.id}
              target={[pt.x + dx, 0.45, pt.z + dz]}
              color={p.color}
              current={p.id === currentId}
              reducedMotion={reducedMotion}
            />
          );
        });
      })}
    </group>
  );
}
