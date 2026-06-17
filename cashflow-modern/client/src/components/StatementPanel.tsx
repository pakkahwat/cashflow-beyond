import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicPlayer } from '../lib/types';
import { money, signed } from '../lib/format';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`stmt-row ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PlayerStatement({ p }: { p: PublicPlayer }) {
  const { t } = useTranslation();
  const e = p.expenses;
  return (
    <div className="statement">
      <h4>{t('statement.income')}</h4>
      <Row label={t('stats.salary')} value={money(p.salary)} />
      <Row label={t('stats.passiveIncome')} value={money(p.passiveIncome)} />
      <Row label={t('stats.totalIncome')} value={money(p.totalIncome)} strong />

      <h4>{t('statement.expenses')}</h4>
      <Row label={t('statement.taxes')} value={money(e.taxes)} />
      <Row label={t('statement.homeMortgage')} value={money(e.homeMortgagePayment)} />
      <Row label={t('statement.schoolLoan')} value={money(e.schoolLoanPayment)} />
      <Row label={t('statement.carLoan')} value={money(e.carLoanPayment)} />
      <Row label={t('statement.creditCard')} value={money(e.creditCardPayment)} />
      <Row label={t('statement.bankLoan')} value={money(e.bankLoanPayment)} />
      <Row label={t('statement.other')} value={money(e.otherExpenses)} />
      <Row label={`${t('statement.perChild')} ×${p.babies}`} value={money(e.perChildExpense * p.babies)} />
      <Row label={t('stats.totalExpenses')} value={money(p.totalExpenses)} strong />

      <h4>{t('stats.cashflow')}</h4>
      <Row label={t('stats.cashflow')} value={signed(p.cashFlow)} strong />

      <h4>{t('statement.assets')}</h4>
      <Row label={t('statement.savings')} value={money(p.assets.savings)} />
      {p.assets.realEstates.map((r: any, i: number) => (
        <Row key={'re' + i} label={`🏠 ${r.symbol}`} value={`${signed(r.cashFlow)}/mo`} />
      ))}
      {p.assets.businesses.map((b: any, i: number) => (
        <Row key={'bz' + i} label={`🏢 ${b.symbol}`} value={`${signed(b.cashFlow)}/mo`} />
      ))}
      {p.assets.stocks.map((s: any, i: number) => (
        <Row key={'st' + i} label={`📈 ${s.symbol} ×${s.count}`} value={money(s.price * s.count)} />
      ))}
      {p.assets.preciousMetals.map((g: any, i: number) => (
        <Row key={'gd' + i} label={`🥇 ${g.symbol} ×${g.count}`} value={money(g.cost * g.count)} />
      ))}

      <h4>{t('statement.liabilities')}</h4>
      <Row label={t('statement.homeMortgage')} value={money(p.liabilities.homeMortgage)} />
      <Row label={t('statement.schoolLoan')} value={money(p.liabilities.schoolLoans)} />
      <Row label={t('statement.carLoan')} value={money(p.liabilities.carLoans)} />
      <Row label={t('statement.creditCard')} value={money(p.liabilities.creditCardDebt)} />
      <Row label={t('statement.bankLoan')} value={money(p.liabilities.bankLoan)} />
    </div>
  );
}

export default function StatementPanel({
  me,
  players
}: {
  me: PublicPlayer | null;
  players: PublicPlayer[];
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'me' | 'others' | 'ledger'>('me');
  const [otherIdx, setOtherIdx] = useState(0);
  const others = players.filter((p) => p.id !== me?.id);

  return (
    <div className="statement-panel">
      <div className="tabs">
        <button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}>
          {t('tabs.me')}
        </button>
        <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>
          {t('tabs.others')}
        </button>
        <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>
          {t('tabs.ledger')}
        </button>
      </div>

      <div className="tab-body">
        {tab === 'me' && me && <PlayerStatement p={me} />}
        {tab === 'others' && (
          <>
            <div className="other-switch">
              {others.map((p, i) => (
                <button
                  key={p.id}
                  className={i === otherIdx ? 'active' : ''}
                  style={{ borderColor: p.color }}
                  onClick={() => setOtherIdx(i)}
                >
                  {p.username}
                </button>
              ))}
            </div>
            {others[otherIdx] && <PlayerStatement p={others[otherIdx]} />}
          </>
        )}
        {tab === 'ledger' && me && (
          <div className="ledger">
            {me.ledger.map((l, i) => (
              <div className="ledger-row" key={i}>
                <span className="desc">{l.description}</span>
                <span className={l.amount >= 0 ? 'pos' : 'neg'}>{signed(l.amount)}</span>
                <span className="bal">{money(l.balance)}</span>
              </div>
            ))}
            {me.ledger.length === 0 && <p className="muted">—</p>}
          </div>
        )}
      </div>
    </div>
  );
}
