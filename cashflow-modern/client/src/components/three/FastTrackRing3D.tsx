import { useTranslation } from 'react-i18next';
import { ringPositions, FT_TILE_COLOR, tokenSlotOffset } from '../../lib/boardLayout3d';
import type { PublicPlayer, FastTrackTile, Dream } from '../../lib/types';
import Tile3D from './Tile3D';
import Token3D from './Token3D';

export interface FastTrackRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  tiles: FastTrackTile[];
  dreams: Dream[];
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

const FT_RADIUS = 7.6;

const KIND_ICON: Record<FastTrackTile['kind'], string> = {
  cashflowDay: '💰',
  investment: '🏢',
  dream: '⭐',
  charity: '❤️',
  loss: '⚠️',
  doodad: '🛍️'
};

export default function FastTrackRing3D({
  players,
  currentId,
  tiles,
  dreams,
  quality,
  reducedMotion
}: FastTrackRing3DProps) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const ring = ringPositions(tiles.length || 32, FT_RADIUS);

  const ftPlayers = players.filter((p) => p.phase === 'fastTrack' && !p.isBankrupt);
  const tokensByCell: Record<number, PublicPlayer[]> = {};
  ftPlayers.forEach((p) => {
    (tokensByCell[p.fastTrackPosition] ||= []).push(p);
  });

  const dreamName = (id?: string) => {
    const d = dreams.find((x) => x.id === id);
    return d ? (lng === 'th' ? d.nameTh : d.name) : '⭐';
  };

  const tileLabelFor = (tile: FastTrackTile): string => {
    switch (tile.kind) {
      case 'dream':
        return dreamName(tile.id);
      case 'investment':
      case 'loss':
        return (lng === 'th' ? tile.nameTh || tile.name : tile.name) ?? '';
      case 'cashflowDay':
        return lng === 'th' ? 'วันรับเงิน' : 'Cashflow';
      case 'charity':
        return lng === 'th' ? 'การกุศล' : 'Charity';
      default:
        return '';
    }
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow={quality === 'high'}>
        <circleGeometry args={[FT_RADIUS + 1.6, 64]} />
        <meshStandardMaterial color="#181f3a" roughness={0.45} metalness={0.55} />
      </mesh>

      {ring.map((pt, idx) => {
        const tile = tiles[idx];
        if (!tile) return null;
        const tokens = tokensByCell[idx] || [];
        const isActiveTile = tokens.some((tk) => tk.id === currentId);
        const rotationY = -pt.angle + Math.PI / 2;
        return (
          <Tile3D
            key={idx}
            position={[pt.x, 0.18, pt.z]}
            rotationY={rotationY}
            color={FT_TILE_COLOR[tile.kind]}
            icon={tile.kind}
            label={tileLabelFor(tile)}
            active={isActiveTile}
            quality={quality}
          />
        );
      })}

      {ring.map((pt, idx) => {
        const tokens = tokensByCell[idx] || [];
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
