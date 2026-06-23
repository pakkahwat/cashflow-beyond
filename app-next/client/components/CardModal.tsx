import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { Card, PublicPlayer } from '../lib/types';
import { money } from '../lib/format';
import { cardsTh } from '../i18n/contentTh';

interface Props {
  card: Card;
  me: PublicPlayer | null;
  isMyTurn: boolean;
}

export default function CardModal({ card, me, isMyTurn }: Props) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const setError = useGame((s) => s.setError);
  const [count, setCount] = useState(1);

  const th = lng === 'th' ? cardsTh[card.id] : undefined;
  const heading = th?.heading ?? card.heading;
  const description = th?.description ?? card.description;
  const rule = th?.rule ?? card.rule;
  const subRule = th?.subRule ?? card.subRule;

  const act = async (action: string, payload?: any) => {
    const res = await emit('cardAction', { action, payload });
    if (!res.ok) setError(res.error || 'generic');
  };

  const ownedStock = me?.assets.stocks.find((s: any) => s.symbol === card.symbol);
  const ownedGold = me?.assets.preciousMetals.find((g: any) => g.symbol === card.symbol);
  const ownedRECount = me?.assets.realEstates?.length ?? 0;
  const family =
    card.type === 'damage' || (card.applicableToEveryOne !== undefined && card.value !== undefined)
      ? 'market'
      : 'deal';
  const isGoldMarket = card.type === 'goldCoins' || (card.symbol || '').toLowerCase() === 'gold';
  const canSellOutOfTurn =
    (card.type === 'stock' && !!ownedStock) ||
    (isGoldMarket && !!ownedGold) ||
    (family === 'market' && card.value !== undefined && ownedRECount > 0) ||
    !!card.applicableToEveryOne;

  return (
    <div className="modal-backdrop">
      <div className={`modal card-modal card-${card.type}`}>
        <div className="card-head">
          <span className="card-type-badge">{card.symbol || card.type}</span>
          <h3>{heading}</h3>
        </div>
        {description && <p className="card-desc">{description}</p>}
        {rule && <p className="card-rule">{rule}</p>}
        {subRule?.map((s, i) => (
          <p className="card-subrule" key={i}>• {s}</p>
        ))}

        <div className="card-stats">
          {card.type === 'realEstate' && (
            <>
              <span>{t('card.downPayment')}: <b>{money(card.downPayment ?? 0)}</b></span>
              <span>{t('card.cost')}: {money(card.cost ?? 0)}</span>
              <span>{t('card.mortgage')}: {money(card.mortgage ?? 0)}</span>
              <span className="cf">{t('card.cashflowPerMonth')}: +{money(card.cashFlow ?? 0)}</span>
            </>
          )}
          {card.type === 'business' && (
            <>
              <span>{t('card.downPayment')}: <b>{money(card.downPayment ?? card.cost ?? 0)}</b></span>
              <span className="cf">{t('card.cashflowPerMonth')}: +{money(card.cashFlow ?? 0)}</span>
            </>
          )}
          {card.type === 'stock' && (
            <span>{t('card.pricePerUnit')}: <b>{money(card.price ?? 0)}</b></span>
          )}
          {(card.type === 'goldCoins' || card.type === 'mlm') && (
            <span>{t('card.cost')}: <b>{money(card.cost ?? 0)}</b></span>
          )}
        </div>

        {isMyTurn ? (
          <div className="card-actions">
            {card.type === 'realEstate' && family === 'deal' && (
              <button className="btn primary" onClick={() => act('buyRealEstate')}>
                {t('card.buy')} ({money(card.downPayment ?? 0)})
              </button>
            )}
            {card.type === 'business' && (
              <button className="btn primary" onClick={() => act('buyBusiness')}>
                {t('card.buy')} ({money(card.downPayment ?? card.cost ?? 0)})
              </button>
            )}
            {card.type === 'mlm' && (
              <button className="btn primary" onClick={() => act('buyMlm')}>
                {t('card.buy')} ({money(card.cost ?? 0)})
              </button>
            )}
            {card.type === 'goldCoins' && family === 'deal' && (
              <button className="btn primary" onClick={() => act('buyGold')}>
                {t('card.buy')} ({money(card.cost ?? 0)})
              </button>
            )}

            {card.type === 'stock' && (
              <div className="qty-row">
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                />
                <button className="btn primary" onClick={() => act('buyStocks', { count })}>
                  {t('card.buy')} {count} ({money((card.price ?? 0) * count)})
                </button>
                {ownedStock && (
                  <button className="btn" onClick={() => act('sellStocks', { count })}>
                    {t('card.sell')} {count}
                  </button>
                )}
              </div>
            )}

            {card.type === 'lottery' && (
              <button className="btn primary" onClick={() => act('acceptLottery')}>
                {t('card.accept')} ({money(card.cost ?? 0)})
              </button>
            )}

            {family === 'market' && isGoldMarket && ownedGold && (
              <div className="qty-row">
                <input
                  type="number"
                  min={1}
                  max={ownedGold.count}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                />
                <button className="btn primary" onClick={() => act('sellGold', { count })}>
                  {t('card.sell')} {count} ({money((card.cost ?? 0) * count)})
                </button>
              </div>
            )}

            {family === 'market' && ownedRECount > 0 && card.value !== undefined && (
              <div className="sell-list">
                <p className="muted">{t('card.marketSell')}</p>
                {me!.assets.realEstates.map((r: any) => (
                  <button key={r.id} className="btn" onClick={() => act('sellRealEstate', { assetId: r.id })}>
                    {t('card.sell')} {r.symbol}
                  </button>
                ))}
              </div>
            )}

            {card.type === 'charity' && (
              <button className="btn primary" onClick={() => act('donate')}>
                {t('card.donate')}
              </button>
            )}
            <button className="btn ghost" onClick={() => act('skip')}>
              {t('card.skip')}
            </button>
          </div>
        ) : canSellOutOfTurn ? (
          <div className="card-actions">
            <p className="muted center">{t('card.othersSell')}</p>
            {card.type === 'stock' && ownedStock && (
              <div className="qty-row">
                <input
                  type="number"
                  min={1}
                  max={ownedStock.count}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(ownedStock.count, Number(e.target.value))))
                  }
                />
                <button className="btn primary" onClick={() => act('sellStocks', { count })}>
                  {t('card.sell')} {count} ({money((card.price ?? 0) * count)})
                </button>
              </div>
            )}
            {isGoldMarket && ownedGold && family === 'market' && (
              <div className="qty-row">
                <input
                  type="number"
                  min={1}
                  max={ownedGold.count}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                />
                <button className="btn primary" onClick={() => act('sellGold', { count })}>
                  {t('card.sell')} {count} ({money((card.cost ?? 0) * count)})
                </button>
              </div>
            )}
            {family === 'market' && ownedRECount > 0 && card.value !== undefined && (
              <div className="sell-list">
                <p className="muted">{t('card.marketSell')}</p>
                {me!.assets.realEstates.map((r: any) => (
                  <button key={r.id} className="btn" onClick={() => act('sellRealEstate', { assetId: r.id })}>
                    {t('card.sell')} {r.symbol}
                  </button>
                ))}
              </div>
            )}
            <p className="muted center small">{t('game.waitingTurn')}</p>
          </div>
        ) : (
          <p className="muted center">{t('game.waitingTurn')}</p>
        )}
      </div>
    </div>
  );
}
