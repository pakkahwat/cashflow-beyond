import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit, leaveRoom } from '../lib/socket';
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
  const reset = useGame((s) => s.reset);
  const [muted, setMutedState] = useState(getMuted());

  const [showProfession, setShowProfession] = useState(false);
  useEffect(() => {
    if (state?.status === 'started') setShowProfession(true);
  }, [state?.status]);

  // Centre-screen dice flourish + walk gating + landing-feedback toast.
  const [rollFx, setRollFx] = useState<{ values: number[]; total: number } | null>(null);
  const [walking, setWalking] = useState(false);
  const [eventToast, setEventToast] = useState<string | null>(null);
  const lastRollKey = useRef('');
  const lastLogTs = useRef(0);
  const walkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // a new roll -> show the dice flourish and gate dialogs until the token finishes
  // walking. The walk timer lives in a ref (NOT the effect cleanup) so unrelated
  // re-renders/state pushes can't cancel it and leave `walking` stuck on.
  useEffect(() => {
    if (!state?.hasRolled || !state.diceValues.length) return;
    const key = `${state.currentPlayerId}|${state.diceValues.join(',')}`;
    if (key === lastRollKey.current) return;
    lastRollKey.current = key;
    const total = state.diceValues.reduce((a, b) => a + b, 0);
    const walkMs = Math.min(2600, Math.max(1100, (total / 6) * 1000 + 500));
    setRollFx({ values: state.diceValues.slice(), total });
    setWalking(true);
    if (walkTimer.current) clearTimeout(walkTimer.current);
    walkTimer.current = setTimeout(() => setWalking(false), walkMs);
  }, [state?.hasRolled, state?.diceValues, state?.currentPlayerId]);

  // auto-dismiss the dice flourish (depends only on rollFx, so state pushes don't disturb it)
  useEffect(() => {
    if (!rollFx) return;
    const id = setTimeout(() => setRollFx(null), 1300);
    return () => clearTimeout(id);
  }, [rollFx]);

  // surface the newest activity-log line as a toast so landing on any tile gives
  // feedback. Logs are stored newest-first (server unshift) -> newest entry is logs[0].
  useEffect(() => {
    const logs = state?.logs;
    if (!logs || !logs.length) return;
    if (lastLogTs.current === 0) {
      lastLogTs.current = logs[0].ts; // seed watermark; skip the backlog on first load
      return;
    }
    if (logs[0].ts <= lastLogTs.current) return;
    lastLogTs.current = logs[0].ts;
    setEventToast(`${logs[0].player} ${logs[0].message}`);
  }, [state?.logs]);
  useEffect(() => {
    if (!eventToast) return;
    const id = setTimeout(() => setEventToast(null), 2800);
    return () => clearTimeout(id);
  }, [eventToast]);
  useEffect(() => () => { if (walkTimer.current) clearTimeout(walkTimer.current); }, []);

  if (!state) return null;

  const isMyTurn = state.currentPlayerId === myId;
  const current = state.players.find((p) => p.id === state.currentPlayerId) ?? null;
  const needRescue = !!me && isMyTurn && me.cash < 0;
  const needDream = !!me && state.awaitingDreamChoice.includes(myId);

  const send = async (event: string, payload?: any) => {
    const res = await emit(event, payload);
    if (!res.ok) setError(res.error || 'generic');
  };

  // Leave the room and return Home to start a brand-new game.
  const newGame = async () => {
    await leaveRoom();
    reset();
  };

  const toggleFullscreen = () => {
    const el = screenRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
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

  // --- status info (shown below the board) ---
  const statusPanel = (
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
    </div>
  );

  // --- action buttons (overlaid on the board in 3D, below it in 2D) so Roll/End
  //     Turn are always reachable without scrolling. ---
  const actionBar = (
    <div className="action-bar">
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
    <div className="game-screen" ref={screenRef}>
      <div className="board-area">
        <div className="board-topbar">
          <span className="phase-pill">
            {me?.phase === 'fastTrack' ? `🚀 ${t('game.fastTrack')}` : `🐭 ${t('game.ratRace')}`}
          </span>
          {me && <span className="prof-pill">{me.professionName}</span>}
          <span className="room-pill">{state.roomId}</span>
          <div className="view-toggles">
            <button className="view-btn newgame" onClick={newGame} title={t('game.newGame')}>
              🔄 {t('game.newGame')}
            </button>
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
            <button className="view-btn" onClick={toggleFullscreen} title={t('game.fullscreen')}>
              ⛶
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
            <div className="board3d-actions">{actionBar}</div>
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
        {!use3d && actionBar}
        {statusPanel}
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
      {eventToast && <div className="event-toast">{eventToast}</div>}
      {!needDream && !walking && state.pendingCard && (
        <CardModal card={state.pendingCard} me={me} isMyTurn={isMyTurn} />
      )}
      {!needDream && !walking && state.pendingFastTrackTile && (
        <FastTrackModal tile={state.pendingFastTrackTile} me={me} isMyTurn={isMyTurn} dreams={dreams} />
      )}
      {!needDream && !walking && state.awaitingDealChoice && isMyTurn && (
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

      {rollFx && (
        <div className="roll-overlay">
          <div className="roll-card">
            <div className="roll-dice">
              {rollFx.values.map((v, i) => (
                <span className="roll-die" key={i}>
                  {v}
                </span>
              ))}
            </div>
            <div className="roll-total">{t('game.rolled', { total: rollFx.total })}</div>
          </div>
        </div>
      )}
    </div>
  );
}
