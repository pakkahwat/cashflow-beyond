import { create } from 'zustand';
import { onState, onId, fetchBoard } from '../lib/socket';
import type { GameState, Dream, FastTrackTile } from '../lib/types';

type Screen = 'home' | 'lobby' | 'game';

interface Store {
  screen: Screen;
  myId: string;
  roomId: string | null;
  state: GameState | null;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  error: string | null;
  setScreen: (s: Screen) => void;
  setRoom: (id: string) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useGame = create<Store>((set) => ({
  screen: 'home',
  myId: '',
  roomId: null,
  state: null,
  dreams: [],
  fastTrack: [],
  error: null,
  setScreen: (screen) => set({ screen }),
  setRoom: (roomId) => set({ roomId }),
  setError: (error) => set({ error }),
  reset: () => set({ screen: 'home', roomId: null, state: null, error: null })
}));

onId((id) => useGame.setState({ myId: id }));

onState((state: GameState) => {
  let next: Screen = 'lobby';
  if (state.status !== 'lobby') next = 'game';
  useGame.setState({ state, screen: next, roomId: state.roomId });
});

fetchBoard()
  .then(({ dreams, fastTrack }) => useGame.setState({ dreams, fastTrack }))
  .catch(() => {});

export const myPlayer = (s: Store) => s.state?.players.find((p) => p.id === s.myId) ?? null;
