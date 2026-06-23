import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { FastTrackTile, PublicPlayer, Dream } from '../lib/types';
import { money } from '../lib/format';

interface Props {
  tile: FastTrackTile;
  me: PublicPlayer | null;
  isMyTurn: boolean;
  dreams: Dream[];
}

export default function FastTrackModal({ tile, me, isMyTurn, dreams }: Props) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const setError = useGame((s) => s.setError);
  const dreamMarkers = useGame((s) => s.state?.dreamMarkers ?? {});

  const act = async (action: 'buy' | 'skip') => {
    const res = await emit('fastTrackAction', { action });
    if (!res.ok) setError(res.error || 'generic');
  };

  const isDream = tile.kind === 'dream';
  const dream = isDream ? dreams.find((d) => d.id === tile.id) : null;
  const isMyDream = isDream && me?.dreamId === tile.id;
  const markers = isDream && tile.id ? (dreamMarkers[tile.id] ?? 0) : 0;
  const displayDreamCost = dream ? dream.cost * (1 + markers) : 0;
  const name = isDream
    ? dream
      ? lng === 'th'
        ? dream.nameTh
        : dream.name
      : ''
    : lng === 'th'
      ? tile.nameTh || tile.name
      : tile.name;

  return (
    <div className="modal-backdrop">
      <div className={`modal ft-modal ft-modal-${tile.kind}`}>
        {tile.kind === 'investment' && (
          <>
            <span className="card-type-badge">{t('fastTrack.investment')}</span>
            <h3>🏢 {name}</h3>
            <div className="card-stats">
              <span>{t('card.downPayment')}: <b>{money(tile.downPayment ?? tile.cost ?? 0)}</b></span>
              {tile.downPayment && tile.cost && tile.downPayment !== tile.cost && (
                <span className="muted">({t('card.cost')}: {money(tile.cost)})</span>
              )}
              <span className="cf">{t('card.cashflowPerMonth')}: +{money(tile.cashFlow ?? 0)}</span>
            </div>
          </>
        )}
        {isDream && (
          <>
            <span className="card-type-badge">
              {isMyDream ? t('fastTrack.yourDream') : t('fastTrack.othersDream')}
            </span>
            <h3>⭐ {name}</h3>
            <div className="card-stats">
              <span>{t('fastTrack.dreamCost')}: <b>{money(displayDreamCost)}</b></span>
              {markers > 0 && <span className="muted"> (+{markers} marker{markers > 1 ? 's' : ''})</span>}
            </div>
          </>
        )}

        {isMyTurn ? (
          <div className="card-actions">
            {tile.kind === 'investment' && (
              <button className="btn primary" onClick={() => act('buy')}>
                {t('fastTrack.invest')} ({money(tile.downPayment ?? tile.cost ?? 0)})
              </button>
            )}
            {isDream && isMyDream && (
              <button className="btn win" onClick={() => act('buy')}>
                {t('fastTrack.buyDream')} ({money(displayDreamCost)})
              </button>
            )}
            <button className="btn ghost" onClick={() => act('skip')}>
              {t('card.skip')}
            </button>
          </div>
        ) : (
          <p className="muted center">{t('game.waitingTurn')}</p>
        )}
      </div>
    </div>
  );
}
