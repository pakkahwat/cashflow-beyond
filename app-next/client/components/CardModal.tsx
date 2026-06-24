import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit, offerDeal, respondOffer } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { Card, PublicPlayer } from '../lib/types';
import { money } from '../lib/format';
import { cardsTh } from '../i18n/contentTh';

interface Props {
  card: Card;
  me: PublicPlayer | null;
  isMyTurn: boolean;
}

/** Coarse property category, mirrors engine reCategory: a Plex buyer can only buy a
 *  plex, etc. null = un-targeted type (sellable by any buyer, never stranded). */
const reCategory = (symbol?: string): string | null => {
  const s = (symbol ?? '').toLowerCase();
  if (s.includes('plex')) return 'plex';
  if (s.includes('2br/1ba')) return '2br/1ba';
  if (s.includes('3br/2ba')) return '3br/2ba';
  return null;
};

export default function CardModal({ card, me, isMyTurn }: Props) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const setError = useGame((s) => s.setError);
  const state = useGame((s) => s.state);
  const myId = useGame((s) => s.myId);
  // Stored as a string so the field can be cleared while typing (a numeric state
  // clamped to >=1 snaps back to "1" and feels un-deletable).
  const [qty, setQty] = useState('1');
  const [picking, setPicking] = useState(false);
  const n = Math.max(1, parseInt(qty || '0', 10) || 0);
  const onQty = (e: React.ChangeEvent<HTMLInputElement>) =>
    setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));

  const th = lng === 'th' ? cardsTh[card.id] : undefined;
  const heading = th?.heading ?? card.heading;
  const description = th?.description ?? card.description;
  const rule = th?.rule ?? card.rule;
  const subRule = th?.subRule ?? card.subRule;

  const act = async (action: string, payload?: any) => {
    const res = await emit('cardAction', { action, payload });
    if (!res.ok) setError(res.error || 'generic');
  };
  const guard = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const res = await p;
    if (!res.ok) setError(res.error || 'generic');
  };

  // A buyer card is a MARKET SALE offer when it carries a sale price (value/plus);
  // deal cards (buyable) have neither. Same rule the engine uses.
  const isMarketSale = card.value !== undefined || !!card.plus;

  const ownedStock = me?.assets.stocks.find((s: any) => s.symbol === card.symbol);
  const ownedGold = me?.assets.preciousMetals.find((g: any) => g.symbol === card.symbol);
  const ownedBiz = me?.assets.businesses ?? [];
  const buyerReCat = reCategory(card.symbol);
  const sellableRE = (me?.assets.realEstates ?? []).filter((r: any) => {
    const a = reCategory(r.symbol);
    return !(buyerReCat && a && buyerReCat !== a);
  });

  const isGoldMarket = card.type === 'goldCoins' || (card.symbol || '').toLowerCase() === 'gold';
  const goldFamily =
    card.type === 'damage' || (card.applicableToEveryOne !== undefined && card.value !== undefined)
      ? 'market'
      : 'deal';

  // --- Peer-to-peer deal offer (rulebook: sell the option to another player) ---
  const offer = state?.pendingOffer ?? null;
  const iAmRecipient = !!offer && offer.toId === myId;
  const iOffered = !!offer && offer.fromId === myId;
  const offerableDeal = (card.type === 'realEstate' || card.type === 'business') && !isMarketSale;
  const otherPlayers = (state?.players ?? []).filter(
    (pl) => pl.id !== myId && !pl.isBankrupt && pl.phase === 'ratRace'
  );
  const nameOf = (id?: string) => state?.players.find((pl) => pl.id === id)?.username ?? '';

  const canSellRE = card.type === 'realEstate' && isMarketSale && sellableRE.length > 0;
  const canSellBiz = card.type === 'business' && isMarketSale && ownedBiz.length > 0;
  const canSellOutOfTurn =
    (card.type === 'stock' && !!ownedStock) ||
    (isGoldMarket && !!ownedGold) ||
    canSellRE ||
    canSellBiz ||
    !!card.applicableToEveryOne;

  const stockPrice = card.price ?? 0;

  const stockSell = ownedStock && (
    <div className="sell-block">
      <div className="sell-label">{t('card.sell')}</div>
      <div className="sell-pct-row">
        {[25, 50, 75, 100].map((pct) => {
          const shares = pct === 100 ? ownedStock.count : Math.floor((ownedStock.count * pct) / 100);
          return (
            <button key={pct} className="btn" disabled={shares <= 0} onClick={() => act('sellStocks', { count: shares })}>
              {pct === 100 ? t('card.sellAll') : `${pct}%`}
              <small>{shares} {t('card.shares')} · +{money(stockPrice * shares)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );

  const stockHoldings = ownedStock && (
    <div className="holding-info">
      <span>{t('card.youOwnShares', { count: ownedStock.count })}</span>
      <span>{t('card.currentValue')}: <b>{money(stockPrice * ownedStock.count)}</b></span>
    </div>
  );

  const reSell = canSellRE && (
    <div className="sell-list">
      <p className="muted">{t('card.marketSell')}</p>
      {sellableRE.map((r: any) => (
        <button key={r.id} className="btn" onClick={() => act('sellRealEstate', { assetId: r.id })}>
          {t('card.sell')} {r.symbol} (+{money(r.cashFlow)}/mo)
        </button>
      ))}
    </div>
  );

  const bizSell = canSellBiz && (
    <div className="sell-list">
      <p className="muted">{t('card.marketSell')}</p>
      {ownedBiz.map((b: any) => (
        <button key={b.id} className="btn" onClick={() => act('sellBusiness', { assetId: b.id })}>
          {t('card.sell')} {b.symbol} (+{money(b.cashFlow)}/mo)
        </button>
      ))}
    </div>
  );

  // Offer-to-another-player control (current player, buyable deal, nobody offered yet).
  const offerControl = offerableDeal && otherPlayers.length > 0 && (
    picking ? (
      <div className="offer-picker">
        <p className="muted">{t('card.offerTo')}</p>
        {otherPlayers.map((pl) => (
          <button key={pl.id} className="btn" onClick={() => { setPicking(false); guard(offerDeal(pl.id)); }}>
            <span className="dot" style={{ background: pl.color }} /> {pl.username}
          </button>
        ))}
        <button className="btn ghost small" onClick={() => setPicking(false)}>{t('game.cancel')}</button>
      </div>
    ) : (
      <button className="btn" onClick={() => setPicking(true)}>🤝 {t('card.offerDeal')}</button>
    )
  );

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
          {card.type === 'realEstate' && !isMarketSale && (
            <>
              <span>{t('card.downPayment')}: <b>{money(card.downPayment ?? 0)}</b></span>
              <span>{t('card.cost')}: {money(card.cost ?? 0)}</span>
              <span>{t('card.mortgage')}: {money(card.mortgage ?? 0)}</span>
              <span className="cf">{t('card.cashflowPerMonth')}: +{money(card.cashFlow ?? 0)}</span>
            </>
          )}
          {card.type === 'business' && !isMarketSale && (
            <>
              <span>{t('card.downPayment')}: <b>{money(card.downPayment ?? card.cost ?? 0)}</b></span>
              <span className="cf">{t('card.cashflowPerMonth')}: +{money(card.cashFlow ?? 0)}</span>
            </>
          )}
          {card.type === 'stock' && <span>{t('card.pricePerUnit')}: <b>{money(stockPrice)}</b></span>}
          {(card.type === 'goldCoins' || card.type === 'mlm') && (
            <span>{t('card.cost')}: <b>{money(card.cost ?? 0)}</b></span>
          )}
        </div>

        {me && (
          <div className="card-cash">
            <span>{t('card.cashOnHand')}</span>
            <b className={me.cash < 0 ? 'neg' : ''}>{money(me.cash)}</b>
          </div>
        )}
        {card.type === 'stock' && stockHoldings}

        {iAmRecipient ? (
          /* A deal was passed to me by another player — buy it or decline. */
          <div className="card-actions">
            <p className="muted center">{t('card.offerReceived', { name: nameOf(offer?.fromId) })}</p>
            <button
              className="btn primary big"
              disabled={(card.downPayment ?? card.cost ?? 0) > (me?.cash ?? 0)}
              onClick={() => guard(respondOffer(true))}
            >
              {t('card.acceptBuy')} ({money(card.downPayment ?? card.cost ?? 0)})
            </button>
            <button className="btn ghost" onClick={() => guard(respondOffer(false))}>{t('card.decline')}</button>
          </div>
        ) : isMyTurn && iOffered ? (
          /* I passed this deal — wait for the recipient to respond. */
          <div className="card-actions">
            <p className="muted center">{t('card.offerWaiting', { name: nameOf(offer?.toId) })}</p>
          </div>
        ) : isMyTurn ? (
          <div className="card-actions">
            {card.type === 'realEstate' && !isMarketSale && (
              <button className="btn primary" onClick={() => act('buyRealEstate')}>
                {t('card.buy')} ({money(card.downPayment ?? 0)})
              </button>
            )}
            {card.type === 'business' && !isMarketSale && (
              <button className="btn primary" onClick={() => act('buyBusiness')}>
                {t('card.buy')} ({money(card.downPayment ?? card.cost ?? 0)})
              </button>
            )}
            {card.type === 'mlm' && (
              <button className="btn primary" onClick={() => act('buyMlm')}>
                {t('card.buy')} ({money(card.cost ?? 0)})
              </button>
            )}
            {card.type === 'goldCoins' && goldFamily === 'deal' && (
              <button className="btn primary" onClick={() => act('buyGold')}>
                {t('card.buy')} ({money(card.cost ?? 0)})
              </button>
            )}

            {card.type === 'stock' && (
              <>
                <div className="qty-row">
                  <input type="text" inputMode="numeric" value={qty} onChange={onQty} />
                  <button
                    className="btn primary"
                    disabled={stockPrice * n > (me?.cash ?? 0)}
                    onClick={() => act('buyStocks', { count: n })}
                  >
                    {t('card.buy')} {n} ({money(stockPrice * n)})
                  </button>
                </div>
                {stockSell}
              </>
            )}

            {card.type === 'lottery' && (
              <button className="btn primary" onClick={() => act('acceptLottery')}>
                {t('card.accept')} ({money(card.cost ?? 0)})
              </button>
            )}

            {isGoldMarket && goldFamily === 'market' && ownedGold && (
              <div className="qty-row">
                <input type="text" inputMode="numeric" value={qty} onChange={onQty} />
                <button className="btn primary" onClick={() => act('sellGold', { count: Math.min(n, ownedGold.count) })}>
                  {t('card.sell')} {Math.min(n, ownedGold.count)} ({money((card.cost ?? 0) * Math.min(n, ownedGold.count))})
                </button>
              </div>
            )}

            {reSell}
            {bizSell}

            {card.type === 'charity' && (
              <button className="btn primary" onClick={() => act('donate')}>
                {t('card.donate')}
              </button>
            )}

            {offerControl}

            <button className="btn ghost" onClick={() => act('skip')}>
              {t('card.skip')}
            </button>
          </div>
        ) : canSellOutOfTurn ? (
          <div className="card-actions">
            <p className="muted center">{t('card.othersSell')}</p>
            {card.type === 'stock' && ownedStock && stockSell}
            {isGoldMarket && ownedGold && goldFamily === 'market' && (
              <div className="qty-row">
                <input type="text" inputMode="numeric" value={qty} onChange={onQty} />
                <button className="btn primary" onClick={() => act('sellGold', { count: Math.min(n, ownedGold.count) })}>
                  {t('card.sell')} {Math.min(n, ownedGold.count)} ({money((card.cost ?? 0) * Math.min(n, ownedGold.count))})
                </button>
              </div>
            )}
            {reSell}
            {bizSell}
            <p className="muted center small">{t('game.waitingTurn')}</p>
          </div>
        ) : (
          <p className="muted center">{t('game.waitingTurn')}</p>
        )}
      </div>
    </div>
  );
}
