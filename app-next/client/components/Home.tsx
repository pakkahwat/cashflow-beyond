import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoom, joinRoom, createBotGame } from '../lib/socket';
import { useGame } from '../store/gameStore';

interface Props {
  onProfile: () => void;
}

export default function Home({ onProfile }: Props) {
  const { t } = useTranslation();
  const setError = useGame((s) => s.setError);
  const setRoom = useGame((s) => s.setRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [botCount, setBotCount] = useState(1);

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

  return (
    <div className="screen home">
      <div className="hero">
        <h1 className="logo">{t('app.title')}</h1>
        <p className="subtitle">{t('app.subtitle')}</p>
        <p className="tagline">{t('app.tagline')}</p>
        <button
          className="btn small ghost"
          onClick={onProfile}
          style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.75 }}
        >
          {t('home.profile', 'My Profile')}
        </button>
      </div>

      <div className="card-panel">
        <input
          className="text-input"
          placeholder={t('home.namePlaceholder')}
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn primary big" disabled={busy} onClick={create}>
          {t('home.createRoom')}
        </button>

        <div className="divider"><span>{t('home.or')}</span></div>

        <div className="join-row">
          <input
            className="text-input"
            placeholder={t('home.roomCodePlaceholder')}
            value={code}
            maxLength={5}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn" disabled={busy} onClick={join}>
            {t('home.join')}
          </button>
        </div>

        <div className="divider"><span>{t('home.or')}</span></div>

        <div className="bot-row">
          <button className="btn primary big bot-play-btn" disabled={busy} onClick={playVsBots}>
            {t('home.playVsBots')}
          </button>
          <div className="bot-count-selector">
            <span className="bot-count-label">{t('home.botCount')}</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={`btn small${botCount === n ? ' primary' : ''}`}
                disabled={busy}
                onClick={() => setBotCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
