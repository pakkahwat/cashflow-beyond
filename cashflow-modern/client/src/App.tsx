import { useGame } from './store/gameStore';
import LangToggle from './components/LangToggle';
import Toast from './components/Toast';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="app">
      <LangToggle />
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'game' && <Game />}
      <Toast />
    </div>
  );
}
