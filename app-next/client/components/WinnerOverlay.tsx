import { useTranslation } from 'react-i18next';
import { leaveRoom } from '../lib/socket';
import { useGame } from '../store/gameStore';
import type { GameState } from '../lib/types';
import Confetti from './Confetti';

export default function WinnerOverlay({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const reset = useGame((s) => s.reset);
  const winner = state.players.find((p) => p.id === state.winnerId);

  const playAgain = async () => {
    await leaveRoom();
    reset();
  };

  return (
    <div className="modal-backdrop win-backdrop">
      {winner && <Confetti />}
      <div className="modal winner-modal">
        <div className="trophy">🏆</div>
        <h2>{t('winner.title')}</h2>
        {winner ? (
          <p className="winner-name" style={{ color: winner.color }}>
            {t('winner.won', { name: winner.username })}
          </p>
        ) : (
          <p>{t('winner.everyoneBankrupt')}</p>
        )}
        <button className="btn primary big" onClick={playAgain}>
          {t('winner.playAgain')}
        </button>
      </div>
    </div>
  );
}
