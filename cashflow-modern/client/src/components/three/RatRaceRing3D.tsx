import { useTranslation } from 'react-i18next';
import { ratTileType, tileLabel } from '../../lib/boardLayout';
import { ringPositions, ratTileColor, tokenSlotOffset } from '../../lib/boardLayout3d';
import type { PublicPlayer } from '../../lib/types';
import Tile3D from './Tile3D';
import Token3D from './Token3D';
import BoardBase from './BoardBase';

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
      <BoardBase radius={RAT_RADIUS} quality={quality} />

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

      {/* Tokens rendered as a FLAT list keyed by player id (not nested under tile
          groups) so each token's instance persists when it changes tiles — that is
          what lets Token3D animate the walk instead of snapping. */}
      {ratPlayers.map((p) => {
        const pos = p.position === 0 ? 24 : p.position; // 1..24
        const mates = tokensByPos[pos] || [p];
        const slot = Math.max(0, mates.findIndex((m) => m.id === p.id));
        const { dx, dz } = tokenSlotOffset(slot, mates.length, 0.45);
        return (
          <Token3D
            key={p.id}
            targetIndex={pos - 1}
            count={TILE_COUNT}
            radius={RAT_RADIUS}
            dx={dx}
            dz={dz}
            color={p.color}
            current={p.id === currentId}
            reducedMotion={reducedMotion}
            name={p.username}
            variant={players.findIndex((pp) => pp.id === p.id) % 6}
          />
        );
      })}
    </group>
  );
}
