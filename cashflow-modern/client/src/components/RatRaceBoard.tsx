import { useTranslation } from 'react-i18next';
import { ratTileType, tileLabel } from '../lib/boardLayout';
import type { PublicPlayer } from '../lib/types';

interface Props {
  players: PublicPlayer[];
  currentId: string | null;
  center: React.ReactNode;
}

const TILE_COUNT = 24;
const RADIUS = 42; // % from center to tile centers

export default function RatRaceBoard({ players, currentId, center }: Props) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';

  const ratPlayers = players.filter((p) => p.phase === 'ratRace' && !p.isBankrupt);
  const tokensByPos: Record<number, PublicPlayer[]> = {};
  ratPlayers.forEach((p) => {
    const pos = p.position === 0 ? 24 : p.position;
    (tokensByPos[pos] ||= []).push(p);
  });

  return (
    <div className="ring-wrap">
      <div className="ring-board">
        {Array.from({ length: TILE_COUNT }, (_, idx) => {
          const position = idx + 1; // 1..24
          const type = ratTileType(position);
          const label = tileLabel[type];
          const tokens = tokensByPos[position] || [];
          const theta = (-90 + idx * (360 / TILE_COUNT)) * (Math.PI / 180);
          const x = 50 + RADIUS * Math.cos(theta);
          const y = 50 + RADIUS * Math.sin(theta);
          const isCurrentTile = tokens.some((t) => t.id === currentId);
          return (
            <div
              key={idx}
              className={`ring-tile tile-${type} ${isCurrentTile ? 'on-current' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="tile-icon">{label.icon}</span>
              <span className="tile-name">{label[lng]}</span>
              {tokens.length > 0 && (
                <div className="tokens">
                  {tokens.map((p) => (
                    <span
                      key={p.id}
                      className={`token ${p.id === currentId ? 'current' : ''}`}
                      style={{ background: p.color }}
                      title={p.username}
                    >
                      {p.username[0]?.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="ring-center">
          <div className="ring-logo">
            CA$HRICH
            <span className="ring-sub">หนีออกจากวงจรหนูถีบจักร</span>
          </div>
          {center}
        </div>
      </div>
    </div>
  );
}
