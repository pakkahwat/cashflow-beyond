import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoom, joinRoom, createBotGame } from '../lib/socket';
import { useGame } from '../store/gameStore';
import { useAuth } from './AuthGate';

type Mode = 'create' | 'join' | 'bots';

interface Props {
  onProfile: () => void;
}

export default function Home({ onProfile }: Props) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const setError = useGame((s) => s.setError);
  const setRoom = useGame((s) => s.setRoom);
  const resetGame = useGame((s) => s.reset);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [botCount, setBotCount] = useState(1);
  const [mode, setMode] = useState<Mode>('create');

  const create = async () => {
    if (!name.trim()) return setError('name_required');
    setBusy(true);
    const res = await createRoom(name.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error || 'generic');
    if (res.roomId) setRoom(res.roomId);
  };

  const join = async () => {
    if (!name.trim()) return setError('name_required');
    if (!code.trim()) return setError('room_not_found');
    setBusy(true);
    const res = await joinRoom(code.trim().toUpperCase(), name.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error || 'generic');
    if (res.roomId) setRoom(res.roomId);
  };

  const playVsBots = async () => {
    if (!name.trim()) return setError('name_required');
    setBusy(true);
    const res = await createBotGame(name.trim(), botCount);
    setBusy(false);
    if (!res.ok) return setError(res.error || 'generic');
    if (res.roomId) setRoom(res.roomId);
  };

  const handleSignOut = () => {
    resetGame();
    signOut();
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: 'create', label: t('home.tabCreate', 'Create') },
    { key: 'join', label: t('home.tabJoin', 'Join') },
    { key: 'bots', label: t('home.tabBots', 'Bots') },
  ];

  return (
    <div className="screen home">
      <div className="hero">
        <h1 className="logo">{t('app.title')}</h1>
        <p className="subtitle">{t('app.subtitle')}</p>
        <p className="tagline">{t('app.tagline')}</p>
      </div>

      <div className="card-panel">
        <input
          className="text-input"
          placeholder={t('home.namePlaceholder')}
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mode-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={mode === tab.key}
              className={mode === tab.key ? 'active' : ''}
              onClick={() => setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'create' && (
          <div className="mode-panel">
            <button className="btn primary big" disabled={busy} onClick={create}>
              {t('home.createRoom')}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="mode-panel">
            <div className="join-row">
              <input
                className="text-input"
                placeholder={t('home.roomCodePlaceholder')}
                value={code}
                maxLength={5}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button className="btn primary" disabled={busy} onClick={join}>
                {t('home.join')}
              </button>
            </div>
          </div>
        )}

        {mode === 'bots' && (
          <div className="mode-panel bot-panel">
            <div className="bot-count-selector">
              <span className="bot-count-label">{t('home.botCount')}</span>
              <div className="seg" role="group">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`seg-btn${botCount === n ? ' active' : ''}`}
                    disabled={busy}
                    onClick={() => setBotCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn primary big bot-play-btn" disabled={busy} onClick={playVsBots}>
              🤖 {t('home.playVsBots')}
            </button>
          </div>
        )}
      </div>

      <div className="home-footer">
        <button className="btn ghost small" onClick={onProfile}>
          {t('home.profile', 'My Profile')}
        </button>
        <button className="btn ghost small" onClick={handleSignOut}>
          {t('home.signOut', 'Sign out')}
        </button>
      </div>
    </div>
  );
}
