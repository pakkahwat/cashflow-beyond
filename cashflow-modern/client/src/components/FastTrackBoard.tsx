import { useTranslation } from 'react-i18next';
import { FT_GRID, ftCells } from '../lib/boardLayout';
import type { PublicPlayer, FastTrackTile, Dream } from '../lib/types';

interface Props {
  players: PublicPlayer[];
  currentId: string | null;
  tiles: FastTrackTile[];
  dreams: Dream[];
  center: React.ReactNode;
}

const kindIcon: Record<string, string> = {
  cashflowDay: '💰',
  investment: '🏢',
  dream: '⭐',
  charity: '❤️',
  loss: '⚠️',
  doodad: '🛍️'
};

export default function FastTrackBoard({ players, currentId, tiles, dreams, center }: Props) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';

  const ftPlayers = players.filter((p) => p.phase === 'fastTrack' && !p.isBankrupt);
  const tokensByCell: Record<number, PublicPlayer[]> = {};
  ftPlayers.forEach((p) => {
    (tokensByCell[p.fastTrackPosition] ||= []).push(p);
  });

  const dreamName = (id?: string) => {
    const d = dreams.find((x) => x.id === id);
    return d ? (lng === 'th' ? d.nameTh : d.name) : '⭐';
  };

  return (
    <div
      className="board ft-board"
      style={{
        gridTemplateColumns: `repeat(${FT_GRID}, 1fr)`,
        gridTemplateRows: `repeat(${FT_GRID}, 1fr)`
      }}
    >
      {ftCells.map((cell, idx) => {
        const tile = tiles[idx];
        if (!tile) return null;
        const tokens = tokensByCell[idx] || [];
        const name =
          tile.kind === 'dream'
            ? dreamName(tile.id)
            : tile.kind === 'investment' || tile.kind === 'loss'
              ? lng === 'th'
                ? tile.nameTh || tile.name
                : tile.name
              : tile.kind === 'cashflowDay'
                ? lng === 'th'
                  ? 'วันรับเงิน'
                  : 'Cashflow'
                : tile.kind === 'charity'
                  ? lng === 'th'
                    ? 'การกุศล'
                    : 'Charity'
                  : '';
        return (
          <div
            key={idx}
            className={`tile ft-tile ft-${tile.kind}`}
            style={{ gridRow: cell.row, gridColumn: cell.col }}
          >
            <span className="tile-icon">{kindIcon[tile.kind]}</span>
            <span className="tile-name ft-name">{name}</span>
            {tile.kind === 'investment' && (
              <span className="ft-cf">+${(tile.cashFlow ?? 0).toLocaleString()}</span>
            )}
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
      <div className="board-center" style={{ gridRow: '2 / 9', gridColumn: '2 / 9' }}>
        {center}
      </div>
    </div>
  );
}
