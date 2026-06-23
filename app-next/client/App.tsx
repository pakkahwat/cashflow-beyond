'use client';
import { useTranslation } from 'react-i18next';
import { useGame } from './store/gameStore';
import LangToggle from './components/LangToggle';
import Toast from './components/Toast';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
  const { t } = useTranslation();
  const screen = useGame((s) => s.screen);
  const resuming = useGame((s) => s.resuming);
  const hasState = useGame((s) => !!s.state);

  const showResume = resuming && !hasState;

  return (
    <div className="app">
      <LangToggle />
      {showResume ? (
        <div className="screen resume-splash">
          <div className="logo">CA$HRICH</div>
          <div className="spinner" />
          <p>{t('game.reconnecting')}</p>
        </div>
      ) : (
        <>
          {screen === 'home' && <Home />}
          {screen === 'lobby' && <Lobby />}
          {screen === 'game' && <Game />}
        </>
      )}
      <Toast />
    </div>
  );
}
