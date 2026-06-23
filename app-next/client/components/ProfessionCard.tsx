import { useTranslation } from 'react-i18next';
import type { PublicPlayer } from '../lib/types';
import { money, signed } from '../lib/format';
import { professionsTh } from '../i18n/contentTh';

export default function ProfessionCard({ me, onClose }: { me: PublicPlayer; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const professionName =
    lng === 'th' ? professionsTh[me.professionName] ?? me.professionName : me.professionName;
  const e = me.expenses;

  return (
    <div className="modal-backdrop">
      <div className="modal profession-modal">
        <div className="prof-head">
          <span className="prof-badge">{t('profession.your')}</span>
          <h2 className="prof-name">{professionName}</h2>
          <p className="prof-goal">{t('stats.goal')}</p>
        </div>

        <div className="prof-grid">
          <div className="prof-col">
            <h4>{t('statement.income')}</h4>
            <div className="stmt-row"><span>{t('stats.salary')}</span><span>{money(me.salary)}</span></div>
            <div className="stmt-row"><span>{t('stats.passiveIncome')}</span><span>{money(me.passiveIncome)}</span></div>
            <div className="stmt-row strong"><span>{t('stats.totalIncome')}</span><span>{money(me.totalIncome)}</span></div>

            <h4>{t('statement.expenses')}</h4>
            <div className="stmt-row"><span>{t('statement.taxes')}</span><span>{money(e.taxes)}</span></div>
            <div className="stmt-row"><span>{t('statement.homeMortgage')}</span><span>{money(e.homeMortgagePayment)}</span></div>
            <div className="stmt-row"><span>{t('statement.carLoan')}</span><span>{money(e.carLoanPayment)}</span></div>
            <div className="stmt-row"><span>{t('statement.creditCard')}</span><span>{money(e.creditCardPayment)}</span></div>
            <div className="stmt-row"><span>{t('statement.other')}</span><span>{money(e.otherExpenses)}</span></div>
            <div className="stmt-row strong"><span>{t('stats.totalExpenses')}</span><span>{money(me.totalExpenses)}</span></div>
          </div>

          <div className="prof-col">
            <div className="prof-cashflow">
              <span>{t('stats.cashflow')}</span>
              <b className={me.cashFlow < 0 ? 'neg' : 'pos'}>{signed(me.cashFlow)}</b>
            </div>
            <h4>{t('statement.assets')}</h4>
            <div className="stmt-row"><span>{t('statement.savings')} / {t('stats.cash')}</span><span>{money(me.cash)}</span></div>

            <h4>{t('statement.liabilities')}</h4>
            <div className="stmt-row"><span>{t('statement.homeMortgage')}</span><span>{money(me.liabilities.homeMortgage)}</span></div>
            <div className="stmt-row"><span>{t('statement.schoolLoan')}</span><span>{money(me.liabilities.schoolLoans)}</span></div>
            <div className="stmt-row"><span>{t('statement.carLoan')}</span><span>{money(me.liabilities.carLoans)}</span></div>
            <div className="stmt-row"><span>{t('statement.creditCard')}</span><span>{money(me.liabilities.creditCardDebt)}</span></div>
          </div>
        </div>

        <button className="btn primary big" onClick={onClose}>
          {t('profession.start')}
        </button>
      </div>
    </div>
  );
}
