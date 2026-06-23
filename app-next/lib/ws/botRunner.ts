import { rooms, type Room } from './RoomManager.js';
import { nextBotAction, type BotAction } from './botPolicy.js';

/** Delay between consecutive bot actions, so a human can watch the bot play. */
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS) || 700;

/** Hard ceiling on actions a single bot may take in one turn before we force an
 *  endTurn. A normal turn is a handful of actions; this purely guards against a
 *  policy/engine disagreement looping forever. */
const MAX_ACTIONS_PER_TURN = 40;

type GameWithActions = Room['game'] & Record<string, (...a: unknown[]) => { ok: boolean; error?: string }>;

/**
 * If the current turn belongs to a bot, auto-play it (and any following bot
 * turns) one action at a time, `BOT_DELAY_MS` apart, re-broadcasting after each.
 * Stops the moment control returns to a human or the game ends.
 *
 * Deadlock safety:
 *  - acts ONLY while `state.currentPlayerId` is in `room.bots`;
 *  - every iteration either advances the engine (a successful action) or ends
 *    the turn, so progress is guaranteed;
 *  - a per-turn action cap forces `endTurn` if a turn somehow stalls;
 *  - if even `endTurn` fails (truly stuck), the loop stops rather than spinning;
 *  - a `botRunning` flag prevents overlapping schedulers (e.g. a human action
 *    arriving mid-bot-turn won't start a second loop).
 */
export function maybeRunBots(room: Room, broadcast: (room: Room) => void): void {
  if (!room.bots || room.bots.size === 0) return;
  if (room.botRunning) return; // a loop is already scheduled for this room

  const game = room.game as GameWithActions;
  const isBotTurn = () => {
    // Stop a zombie loop if the room was evicted from the manager.
    if (rooms.get(room.code) !== room) return false;
    const cur = game.getState().currentPlayerId;
    return game.status === 'started' && cur !== null && room.bots!.has(cur);
  };

  if (!isBotTurn()) return;

  room.botRunning = true;
  let actionsThisTurn = 0;
  let turnPlayerId = game.getState().currentPlayerId;

  const stop = () => {
    room.botRunning = false;
  };

  const step = () => {
    // Stop conditions: game over, or control handed to a human.
    if (!isBotTurn()) return stop();

    const state = game.getState();
    const botId = state.currentPlayerId!;

    // New bot took over (turn advanced to another bot) — reset the per-turn cap.
    if (botId !== turnPlayerId) {
      turnPlayerId = botId;
      actionsThisTurn = 0;
    }

    const action: BotAction | null = nextBotAction(state, botId);

    let res: { ok: boolean; error?: string };
    if (action === null || actionsThisTurn >= MAX_ACTIONS_PER_TURN) {
      // Nothing left to do (or cap hit) → end the turn.
      res = game.endTurn(botId);
      if (!res.ok) {
        // Couldn't even end the turn: avoid an infinite loop. Broadcast current
        // state and stop; a human action (or reconnect) can unstick the room.
        broadcast(room);
        return stop();
      }
      actionsThisTurn = 0;
      turnPlayerId = game.getState().currentPlayerId;
    } else {
      res = Reflect.apply(game[action.method], game, [botId, ...action.args]);
      actionsThisTurn += 1;
      if (!res.ok) {
        // The policy proposed an action the engine rejected. Fall back to ending
        // the turn so the loop always advances rather than retrying forever.
        const ended = game.endTurn(botId);
        if (!ended.ok) {
          broadcast(room);
          return stop();
        }
        actionsThisTurn = 0;
        turnPlayerId = game.getState().currentPlayerId;
      }
    }

    broadcast(room);

    // Still a bot's turn? schedule the next action; otherwise we're done.
    if (isBotTurn()) {
      setTimeout(step, BOT_DELAY_MS);
    } else {
      stop();
    }
  };

  // Kick off the first action after the delay so the human sees the handoff.
  setTimeout(step, BOT_DELAY_MS);
}
