import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame, myPlayer } from '../store/gameStore';
import RatRaceBoard from './RatRaceBoard';
import FastTrackBoard from './FastTrackBoard';
import Board3D from './three/Board3D';
import StatementPanel from './StatementPanel';
import LoanPanel from './LoanPanel';
import CardModal from './CardModal';
import FastTrackModal from './FastTrackModal';
import DreamPicker from './DreamPicker';
import WinnerOverlay from './WinnerOverlay';
import ProfessionCard from './ProfessionCard';
import Dice3D from './Dice3D';
import { hasWebGL } from '../lib/webgl';
import { getMuted, setMuted } from '../lib/sfx';
import { money, signed } from '../lib/format';
import { FAST_TRACK_GOAL } from '../lib/constants';

export default function Game() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const myId = useGame((s) => s.myId);
  const me = useGame(myPlayer);
  const dreams = useGame((s) => s.dreams);
  const fastTrack = useGame((s) => s.fastTrack);
  const setError = useGame((s) => s.setError);
  const render3d = useGame((s) => s.render3d);
  const quality = useGame((s) => s.quality);
  const setRender3d = useGame((s) => s.setRender3d);
  const setQuality = useGame((s) => s.setQuality);
  const webglOk = useMemo(() => hasWebGL(), []);
  const use3d = render3d && webglOk;
  const [muted, setMutedState] = useState(getMuted());

  const [showProfession, setShowProfession] = useState(false);
  useEffect(() => {
    if (state?.status === 'started') setShowProfession(true);
  }, [state?.status]);

  if (!state) return null;

  const isMyTurn = state.currentPlayerId === myId;
  const current = state.players.find((p) => p.id === state.currentPlayerId) ?? null;
  const needRescue = !!me && isMyTurn && me.cash < 0;
  const needDream = !!me && state.awaitingDreamChoice.includes(myId);

  const send = async (event: string, payload?: any) => {
    const res = await emit(event, payload);
    if (!res.ok) setError(res.error || 'generic');
  };

  const canRoll = isMyTurn && !state.hasRolled && state.status === 'started' && !me?.isBankrupt;
  const canEnd =
    isMyTurn &&
    state.hasRolled &&
    !state.pendingCard &&
    !state.pendingFastTrackTile &&
    !state.awaitingDealChoice &&
    !needRescue;
  const showDiceChoice = canRoll && me?.phase === 'ratRace' && (me?.extraDiceTurns ?? 0) > 0;
  const showFtDiceChoice = canRoll && me?.phase === 'fastTrack' && !!me?.ftCharityDice;

  // --- turn banner (DOM in both 2D and 3D paths) ---
  const turnBanner = (
    <div className="turn-banner" style={{ borderColor: current?.color }}>
      <span className="dot" style={{ background: current?.color }} />
      {isMyTurn ? t('game.yourTurn') : t('game.turnOf', { name: current?.username })}
    </div>
  );

  // --- CSS-board center: banner + CSS dice (used only in the 2D fallback) ---
  const boardCenter = (
    <div className="center-stack">
      {turnBanner}
      <div className="dice-area">
        {Array.from({ length: state.hasRolled ? state.diceValues.length : me?.phase === 'fastTrack' ? 2 : 1 }).map((_, i) => (
          <Dice3D
            key={i}
            value={state.hasRolled ? state.diceValues[i] ?? null : null}
            trigger={`${state.diceValues.join(',')}|${state.currentPlayerId}|${state.hasRolled}|${i}`}
          />
        ))}
      </div>
    </div>
  );

  // --- controls + status shown below the board ---
  const controls = (
    <div className="play-panel">
      {me && (
        <div className="status-mini">
          <div>
            <span>{t('stats.cash')}</span>
            <b className={me.cash < 0 ? 'neg' : ''}>{money(me.cash)}</b>
          </div>
          <div>
            <span>{t('stats.passiveIncome')}</span>
            <b>{money(me.passiveIncome)}</b>
          </div>
          <div>
            <span>{t('stats.totalExpenses')}</span>
            <b>{money(me.totalExpenses)}</b>
          </div>
          <div>
            <span>{t('stats.cashflow')}</span>
            <b className={me.cashFlow < 0 ? 'neg' : 'pos'}>{signed(me.cashFlow)}</b>
          </div>
        </div>
      )}

      {me?.phase === 'ratRace' && (
        <div className="goal-bar">
          <span>{t('stats.goal')}</span>
          <div className="goal-track">
            <div
              className="goal-fill"
              style={{
                width: `${Math.min(100, (me.passiveIncome / Math.max(1, me.totalExpenses)) * 100)}%`,
                background: me.passiveIncome > me.totalExpenses ? '#2ecc71' : '#f1c40f'
              }}
            />
          </div>
        </div>
      )}

      {me?.phase === 'fastTrack' && (
        <div className="goal-bar">
          <span>{t('fastTrack.goalCashflow')}</span>
          <div className="goal-track">
            <div
              className="goal-fill"
              style={{
                width: `${Math.min(100, (me.fastTrackCashFlowGain / FAST_TRACK_GOAL) * 100)}%`,
                background: '#2ecc71'
              }}
            />
          </div>
          <small>
            {money(me.fastTrackCashFlowGain)} / {money(FAST_TRACK_GOAL)}
          </small>
        </div>
      )}

      {state.awaitingFastTrackChoice === myId && (
        <button className="btn win big" onClick={() => send('enterFastTrack')}>
          🎉 {t('fastTrack.escape')}
        </button>
      )}

      <div className="turn-controls">
        {showDiceChoice ? (
          <>
            <button className="btn primary" onClick={() => send('rollDice', { diceCount: 1 })}>
              {t('game.roll1')}
            </button>
            <button className="btn primary" onClick={() => send('rollDice', { diceCount: 2 })}>
              {t('game.roll2')}
            </button>
          </>
        ) : showFtDiceChoice ? (
          <>
            <button className="btn primary" onClick={() => send('rollDice', { diceCount: 1 })}>
              {t('game.roll1')}
            </button>
            <button className="btn primary" onClick={() => send('rollDice', { diceCount: 2 })}>
              {t('game.roll2')}
            </button>
            <button className="btn primary" onClick={() => send('rollDice', { diceCount: 3 })}>
              {t('game.roll3')}
            </button>
          </>
        ) : (
          <button
            className="btn primary big"
            disabled={!canRoll}
            onClick={() => send('rollDice', { diceCount: me?.phase === 'fastTrack' ? 2 : 1 })}
          >
            🎲 {t('game.roll')}
          </button>
        )}
        <button className="btn" disabled={!canEnd} onClick={() => send('endTurn')}>
          {t('game.endTurn')} ➜
        </button>
      </div>

      {needRescue && (
        <div className="rescue">
          <b>{t('bankrupt.title')}</b>
          <p>{t('bankrupt.message')}</p>
          <button className="btn warn" onClick={() => send('liquidate')}>
            {t('bankrupt.liquidate')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="game-screen">
      <div className="board-area">
        <div className="board-topbar">
          <span className="phase-pill">
            {me?.phase === 'fastTrack' ? `🚀 ${t('game.fastTrack')}` : `🐭 ${t('game.ratRace')}`}
          </span>
          {me && <span className="prof-pill">{me.professionName}</span>}
          <span className="room-pill">{state.roomId}</span>
          <div className="view-toggles">
            <button
              className={`view-btn ${use3d ? 'active' : ''}`}
              disabled={!webglOk}
              onClick={() => setRender3d(!render3d)}
              title={webglOk ? '' : 'WebGL unavailable'}
            >
              {use3d ? '3D' : '2D'}
            </button>
            {use3d && (
              <button
                className={`view-btn ${quality === 'high' ? 'active' : ''}`}
                onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}
              >
                {quality === 'high' ? 'High' : 'Low'}
              </button>
            )}
            <button
              className="view-btn"
              onClick={() => {
                const m = !muted;
                setMuted(m);
                setMutedState(m);
              }}
              title={muted ? t('game.soundOn') ?? 'Sound on' : t('game.soundOff') ?? 'Sound off'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>
        {use3d ? (
          <div className="board3d-wrap">
            <Board3D
              state={state}
              myId={myId}
              dreams={dreams}
              fastTrack={fastTrack}
              quality={quality}
            />
            <div className="board3d-banner">{turnBanner}</div>
          </div>
        ) : me?.phase === 'fastTrack' ? (
          <FastTrackBoard
            players={state.players}
            currentId={state.currentPlayerId}
            tiles={fastTrack}
            dreams={dreams}
            center={boardCenter}
          />
        ) : (
          <RatRaceBoard players={state.players} currentId={state.currentPlayerId} center={boardCenter} />
        )}
        {controls}
      </div>

      <aside className="side-panel">
        <LoanPanel me={me} isMyTurn={isMyTurn} />
        <StatementPanel me={me} players={state.players} />
        <div className="log-panel">
          <h4>{t('game.logs')}</h4>
          <div className="logs">
            {state.logs.map((l, i) => (
              <div className="log-row" key={i}>
                <b style={{ color: l.color }}>{l.player}</b> {l.message}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {me && showProfession && state.status === 'started' && (
        <ProfessionCard me={me} onClose={() => setShowProfession(false)} />
      )}
      {!showProfession && needDream && <DreamPicker dreams={dreams} />}
      {!needDream && state.pendingCard && (
        <CardModal card={state.pendingCard} me={me} isMyTurn={isMyTurn} />
      )}
      {!needDream && state.pendingFastTrackTile && (
        <FastTrackModal tile={state.pendingFastTrackTile} me={me} isMyTurn={isMyTurn} dreams={dreams} />
      )}
      {!needDream && state.awaitingDealChoice && isMyTurn && (
        <div className="modal-backdrop">
          <div className="modal deal-choice">
            <h3>{t('card.chooseDeal')}</h3>
            <div className="deal-choice-row">
              <button className="btn primary big" onClick={() => send('chooseDeal', { size: 'small' })}>
                💼 {t('card.smallDeal')}
                <small>{t('card.smallDealHint')}</small>
              </button>
              <button className="btn primary big" onClick={() => send('chooseDeal', { size: 'big' })}>
                🏢 {t('card.bigDeal')}
                <small>{t('card.bigDealHint')}</small>
              </button>
            </div>
          </div>
        </div>
      )}
      {state.status === 'finished' && <WinnerOverlay state={state} />}
    </div>
  );
}
