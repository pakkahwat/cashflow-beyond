import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { PublicPlayer } from '../lib/types';
import { money } from '../lib/format';

const DEBT_TYPES: { key: string; labelKey: string }[] = [
  { key: 'bankLoan', labelKey: 'statement.bankLoan' },
  { key: 'homeMortgage', labelKey: 'statement.homeMortgage' },
  { key: 'schoolLoans', labelKey: 'statement.schoolLoan' },
  { key: 'carLoans', labelKey: 'statement.carLoan' },
  { key: 'creditCardDebt', labelKey: 'statement.creditCard' }
];

export default function LoanPanel({ me, isMyTurn }: { me: PublicPlayer | null; isMyTurn: boolean }) {
  const { t } = useTranslation();
  const setError = useGame((s) => s.setError);
  const [mode, setMode] = useState<'none' | 'take' | 'pay'>('none');
  const [amount, setAmount] = useState(1000);
  const [debtType, setDebtType] = useState('bankLoan');

  if (!me) return null;

  const take = async () => {
    const res = await emit('takeLoan', { amount });
    if (!res.ok) setError(res.error || 'generic');
    else setMode('none');
  };
  const pay = async () => {
    const res = await emit('payLoan', { type: debtType, amount });
    if (!res.ok) setError(res.error || 'generic');
    else setMode('none');
  };

  return (
    <div className="loan-panel">
      <div className="loan-buttons">
        <button className="btn small" disabled={!isMyTurn} onClick={() => setMode(mode === 'take' ? 'none' : 'take')}>
          {t('game.takeLoan')}
        </button>
        <button className="btn small" disabled={!isMyTurn} onClick={() => setMode(mode === 'pay' ? 'none' : 'pay')}>
          {t('game.payLoan')}
        </button>
      </div>

      {mode === 'take' && (
        <div className="loan-form">
          <input
            type="number"
            min={1000}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button className="btn primary small" onClick={take}>
            {t('game.confirm')}
          </button>
        </div>
      )}

      {mode === 'pay' && (
        <div className="loan-form col">
          <select value={debtType} onChange={(e) => setDebtType(e.target.value)}>
            {DEBT_TYPES.map((d) => (
              <option key={d.key} value={d.key}>
                {t(d.labelKey)} ({money((me.liabilities as any)[d.key] ?? 0)})
              </option>
            ))}
          </select>
          <div className="loan-form">
            <input
              type="number"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <button className="btn primary small" onClick={pay}>
              {t('game.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
