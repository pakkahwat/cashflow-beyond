import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoom, joinRoom } from '../lib/socket';
import { useGame } from '../store/gameStore';

export default function Home() {
  const { t } = useTranslation();
  const setError = useGame((s) => s.setError);
  const setRoom = useGame((s) => s.setRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

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
      </div>
    </div>
  );
}
