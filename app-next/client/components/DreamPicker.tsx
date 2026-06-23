import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { Dream } from '../lib/types';
import { money } from '../lib/format';

export default function DreamPicker({ dreams }: { dreams: Dream[] }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const setError = useGame((s) => s.setError);

  const pick = async (id: string) => {
    const res = await emit('chooseDream', { dreamId: id });
    if (!res.ok) setError(res.error || 'generic');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal dream-picker">
        <h3>🎉 {t('fastTrack.chooseDream')}</h3>
        <p className="muted">{t('fastTrack.chooseDreamHint')}</p>
        <div className="dream-grid">
          {dreams.map((d) => (
            <button key={d.id} className="dream-card" onClick={() => pick(d.id)}>
              <span className="dream-icon">⭐</span>
              <span className="dream-name">{lng === 'th' ? d.nameTh : d.name}</span>
              <span className="dream-cost">{money(d.cost)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
