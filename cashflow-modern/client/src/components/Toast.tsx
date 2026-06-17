import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../store/gameStore';

export default function Toast() {
  const { t } = useTranslation();
  const error = useGame((s) => s.error);
  const setError = useGame((s) => s.setError);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 2800);
    return () => clearTimeout(id);
  }, [error, setError]);

  if (!error) return null;
  const msg = t(`errors.${error}`, { defaultValue: t('errors.generic') });
  return <div className="toast">{msg}</div>;
}
