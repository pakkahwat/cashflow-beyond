import { useTranslation } from 'react-i18next';
import { RAT_GRID, ratCells, ratTileType, tileLabel } from '../lib/boardLayout';
import type { PublicPlayer } from '../lib/types';

interface Props {
  players: PublicPlayer[];
  currentId: string | null;
  center: React.ReactNode;
}

export default function RatRaceBoard({ players, currentId, center }: Props) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';

  const ratPlayers = players.filter((p) => p.phase === 'ratRace' && !p.isBankrupt);
  const tokensByCell: Record<number, PublicPlayer[]> = {};
  ratPlayers.forEach((p) => {
    const cellIdx = p.position === 0 ? ratCells.length - 1 : p.position - 1;
    (tokensByCell[cellIdx] ||= []).push(p);
  });

  return (
    <div
      className="board rat-board"
      style={{
        gridTemplateColumns: `repeat(${RAT_GRID}, 1fr)`,
        gridTemplateRows: `repeat(${RAT_GRID}, 1fr)`
      }}
    >
      {ratCells.map((cell, idx) => {
        const position = idx + 1; // 1..24
        const type = position === 24 ? 'market' : ratTileType(position);
        const label = tileLabel[type];
        const tokens = tokensByCell[idx] || [];
        const isStart = position === 24;
        return (
          <div
            key={idx}
            className={`tile tile-${type} ${isStart ? 'tile-start' : ''}`}
            style={{ gridRow: cell.row, gridColumn: cell.col }}
          >
            <span className="tile-icon">{isStart ? '🏁' : label.icon}</span>
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
      <div className="board-center" style={{ gridRow: '2 / 7', gridColumn: '2 / 7' }}>
        {center}
      </div>
    </div>
  );
}
