import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit, leaveRoom } from '../lib/socket';
import { useGame, myPlayer } from '../store/gameStore';

export default function Lobby() {
  const { t } = useTranslation();
  const state = useGame((s) => s.state);
  const me = useGame(myPlayer);
  const setError = useGame((s) => s.setError);
  const reset = useGame((s) => s.reset);
  const [copied, setCopied] = useState(false);

  if (!state) return null;
  const isHost = !!me?.isHost;
  const difficulty = state.difficulty ?? 'normal';

  const start = async () => {
    const res = await emit('startGame');
    if (!res.ok) setError(res.error || 'generic');
  };
  const pickDifficulty = async (d: 'normal' | 'easy') => {
    if (d === difficulty) return;
    const res = await emit('setDifficulty', { difficulty: d });
    if (!res.ok) setError(res.error || 'generic');
  };
  const leave = async () => {
    await leaveRoom();
    reset();
  };
  const copy = () => {
    navigator.clipboard?.writeText(state.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="screen lobby">
      <h2>{t('lobby.title')}</h2>

      <div className="room-code-box">
        <div className="room-code-label">{t('lobby.roomCode')}</div>
        <div className="room-code">{state.roomId}</div>
        <button className="btn small" onClick={copy}>
          {copied ? t('lobby.copied') : t('lobby.copy')}
        </button>
        <p className="hint">{t('lobby.share')}</p>
      </div>

      <div className="players-list">
        <h3>{t('lobby.players', { count: state.players.length })}</h3>
        {state.players.map((p) => (
          <div className="player-row" key={p.id}>
            <span className="dot" style={{ background: p.color }} />
            <span className="pname">{p.username}</span>
            {p.isHost && <span className="badge">{t('lobby.host')}</span>}
            {!p.connected && <span className="badge off">offline</span>}
          </div>
        ))}
      </div>

      <div className="difficulty-picker">
        <h3>{t('lobby.difficulty')}</h3>
        <div className="difficulty-row">
          <button
            className={`btn small ${difficulty === 'normal' ? 'primary' : ''}`}
            disabled={!isHost}
            onClick={() => pickDifficulty('normal')}
          >
            {t('lobby.normal')}
          </button>
          <button
            className={`btn small ${difficulty === 'easy' ? 'primary' : ''}`}
            disabled={!isHost}
            onClick={() => pickDifficulty('easy')}
          >
            {t('lobby.easy')}
          </button>
        </div>
        {difficulty === 'easy' && <p className="hint">{t('lobby.easyHint')}</p>}
      </div>

      {isHost ? (
        <button className="btn primary big" onClick={start}>
          {t('lobby.start')}
        </button>
      ) : (
        <p className="waiting">{t('lobby.waiting')}</p>
      )}
      <button className="btn ghost" onClick={leave}>
        {t('lobby.leave')}
      </button>
    </div>
  );
}
