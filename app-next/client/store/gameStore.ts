import { create } from 'zustand';
import { onState, onId, fetchBoard, resume, savedRoom } from '../lib/socket';
import { play as playSfx } from '../lib/sfx';
import { soundForLog } from '../lib/logFormat';
import type { GameState, Dream, FastTrackTile } from '../lib/types';

type Screen = 'home' | 'lobby' | 'game';
type Quality = 'high' | 'low';

const readRender3d = (): boolean => {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem('cf_render3d') !== '0'; // default ON
};
const readQuality = (): Quality => {
  if (typeof localStorage === 'undefined') return 'high';
  return localStorage.getItem('cf_quality') === 'low' ? 'low' : 'high';
};

interface Store {
  screen: Screen;
  myId: string;
  roomId: string | null;
  state: GameState | null;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  error: string | null;
  resuming: boolean;
  render3d: boolean;
  quality: Quality;
  setScreen: (s: Screen) => void;
  setRoom: (id: string) => void;
  setError: (e: string | null) => void;
  setRender3d: (v: boolean) => void;
  setQuality: (q: Quality) => void;
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
  resuming: !!savedRoom(),
  render3d: readRender3d(),
  quality: readQuality(),
  setScreen: (screen) => set({ screen }),
  setRoom: (roomId) => set({ roomId }),
  setError: (error) => set({ error }),
  setRender3d: (render3d) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('cf_render3d', render3d ? '1' : '0');
    set({ render3d });
  },
  setQuality: (quality) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('cf_quality', quality);
    set({ quality });
  },
  reset: () => set({ screen: 'home', roomId: null, state: null, error: null })
}));

onId((id) => useGame.setState({ myId: id }));

let sfxLastTs = 0;
onState((state: GameState) => {
  let next: Screen = 'lobby';
  if (state.status !== 'lobby') next = 'game';
  useGame.setState({ state, screen: next, roomId: state.roomId, resuming: false });

  // Sound cue per NEW activity-log entry (runs on every state push, not gated by React render).
  const logs = state.logs || [];
  if (logs.length) {
    if (sfxLastTs === 0) {
      sfxLastTs = logs[0].ts; // first state / resume: don't replay history
    } else {
      const fresh = logs.filter((l) => l.ts > sfxLastTs).reverse(); // chronological
      sfxLastTs = Math.max(sfxLastTs, logs[0].ts);
      let delay = 0;
      for (const l of fresh) {
        const s = soundForLog(l);
        if (s) {
          const at = delay;
          setTimeout(() => playSfx(s), at);
          delay += 240;
        }
      }
    }
  }
});

fetchBoard()
  .then(({ dreams, fastTrack }) => useGame.setState({ dreams, fastTrack }))
  .catch(() => {});

// Attempt to resume a saved game on load. On success, onState() flips the screen.
resume()
  .then((ack) => {
    if (!ack || !ack.ok) useGame.setState({ resuming: false });
  })
  .catch(() => useGame.setState({ resuming: false }));

export const myPlayer = (s: Store) => s.state?.players.find((p) => p.id === s.myId) ?? null;
