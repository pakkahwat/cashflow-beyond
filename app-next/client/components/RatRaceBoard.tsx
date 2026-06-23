import { useTranslation } from 'react-i18next';
import { ratTileType, tileLabel } from '../lib/boardLayout';
import type { PublicPlayer } from '../lib/types';

interface Props {
  players: PublicPlayer[];
  currentId: string | null;
  center: React.ReactNode;
  difficulty?: 'normal' | 'easy';
}

const TILE_COUNT = 24;
const RI = 30; // inner radius of the ring (viewBox units, 0..50)
const RO = 49; // outer radius
const MIDR = 39.5; // radius for icon + label
const TOKENR = 45; // radius for player tokens

const FILL: Record<string, string> = {
  deal: '#3fa14e',
  payday: '#e8821e',
  market: '#2e6fd0',
  doodad: '#d35400',
  charity: '#8e44ad',
  downsized: '#c0392b',
  baby: '#16a085'
};

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
};

const sector = (ri: number, ro: number, a0: number, a1: number) => {
  const [x0o, y0o] = polar(ro, a0);
  const [x1o, y1o] = polar(ro, a1);
  const [x1i, y1i] = polar(ri, a1);
  const [x0i, y0i] = polar(ri, a0);
  return `M ${x0o} ${y0o} A ${ro} ${ro} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${ri} ${ri} 0 0 0 ${x0i} ${y0i} Z`;
};

export default function RatRaceBoard({ players, currentId, center, difficulty = 'normal' }: Props) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';

  const ratPlayers = players.filter((p) => p.phase === 'ratRace' && !p.isBankrupt);
  const tokensByPos: Record<number, PublicPlayer[]> = {};
  ratPlayers.forEach((p) => {
    const pos = p.position === 0 ? 24 : p.position;
    (tokensByPos[pos] ||= []).push(p);
  });
  const currentPos = ratPlayers.find((p) => p.id === currentId)?.position ?? null;
  const step = 360 / TILE_COUNT;

  const tiles = Array.from({ length: TILE_COUNT }, (_, idx) => {
    const position = idx + 1; // 1..24
    const center = -90 + idx * step; // degrees
    return { idx, position, type: ratTileType(position, difficulty), a0: center - step / 2, a1: center + step / 2, mid: center };
  });

  return (
    <div className="ring-wrap">
      <svg className="ring-svg" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="49.6" fill="#0d1630" stroke="#2e3a63" strokeWidth="0.6" />
        {tiles.map((t) => (
          <path
            key={t.idx}
            d={sector(RI, RO, t.a0, t.a1)}
            fill={FILL[t.type]}
            stroke="#0d1630"
            strokeWidth="0.7"
          />
        ))}
        {currentPos !== null && (
          <path
            d={sector(RI, RO, -90 + (((currentPos === 0 ? 24 : currentPos) - 1) * step) - step / 2, -90 + (((currentPos === 0 ? 24 : currentPos) - 1) * step) + step / 2)}
            fill="rgba(255,255,255,0.14)"
            stroke="#f1c40f"
            strokeWidth="1"
          />
        )}
        <circle cx="50" cy="50" r={RI - 0.3} fill="#111a31" stroke="#34406e" strokeWidth="0.7" />
      </svg>

      {tiles.map((t) => {
        const label = tileLabel[t.type];
        const [lx, ly] = polar(MIDR, t.mid);
        return (
          <div className="wedge-content" key={t.idx} style={{ left: `${lx}%`, top: `${ly}%` }}>
            <span className="wedge-icon">{label.icon}</span>
            <span className="wedge-name">{label[lng]}</span>
          </div>
        );
      })}

      {Object.entries(tokensByPos).map(([pos, list]) => {
        const idx = (Number(pos) - 1) % TILE_COUNT;
        const [tx, ty] = polar(TOKENR, -90 + idx * step);
        return (
          <div className="wedge-tokens" key={pos} style={{ left: `${tx}%`, top: `${ty}%` }}>
            {list.map((p) => (
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
  );
}
