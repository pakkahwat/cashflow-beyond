import { useTranslation } from 'react-i18next';
import { setLang } from '../i18n';

export default function LangToggle() {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  return (
    <div className="lang-toggle">
      <button className={lng === 'th' ? 'active' : ''} onClick={() => setLang('th')}>
        ไทย
      </button>
      <button className={lng === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}
