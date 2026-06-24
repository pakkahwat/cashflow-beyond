import { DREAMS } from '../../data/fastTrack.js';
import type { PublicGameState, PublicPlayer, Card, FastTrackTile } from '../../engine/types.js';

/**
 * The set of engine PUBLIC methods a bot may invoke. The runner calls
 * `room.game[method](botId, ...args)`, so every method here takes the player id
 * as its first argument followed by `args`.
 */
export type BotMethod =
  | 'chooseDream'
  | 'rollDice'
  | 'enterFastTrack'
  | 'chooseDeal'
  | 'cardAction'
  | 'fastTrackAction'
  | 'liquidate';

export interface BotAction {
  method: BotMethod;
  args: unknown[];
}

/** Cash floor below which the bot conserves money instead of buying. */
const LOW_CASH = 3000;
/** Above this, the bot will reach for the (more expensive) big deal. */
const BIG_DEAL_CASH = 30000;

const me = (state: PublicGameState, botId: string): PublicPlayer | undefined =>
  state.players.find((p) => p.id === botId);

/**
 * Pure heuristic policy. Inspects the REAL public game state and returns the
 * next engine call the bot should make, or `null` when the bot has nothing left
 * to do this turn (the runner then ends the turn).
 *
 * It never mutates state and performs no I/O. Decision order mirrors the engine's
 * turn flow: dream-at-setup → rescue debt → fast-track entry → roll →
 * deal choice → pending card → pending fast-track tile → (nothing → end turn).
 */
export function nextBotAction(state: PublicGameState, botId: string): BotAction | null {
  if (state.status !== 'started') return null;
  if (state.currentPlayerId !== botId) return null;

  const player = me(state, botId);
  if (!player || player.isBankrupt) return null;

  // 1) Dream choice fires for ALL active players at game start. Resolve it first
  //    (it is required before the turn can proceed in any meaningful way).
  if (state.awaitingDreamChoice.includes(botId) && !player.dreamId) {
    return { method: 'chooseDream', args: [pickDream()] };
  }

  // 2) Rescue: negative cash must be resolved before ending a turn. Liquidate
  //    assets (the engine's only public bot-usable rescue) to climb out of debt.
  if (player.cash < 0) {
    return { method: 'liquidate', args: [] };
  }

  // 3) Fast Track entry is offered BEFORE the roll, while still in the rat race.
  if (state.awaitingFastTrackChoice === botId) {
    return { method: 'enterFastTrack', args: [] };
  }

  // 4) Roll if a roll is awaited.
  if (!state.hasRolled) {
    return { method: 'rollDice', args: [] };
  }

  // 5) Deal-tile choice (small vs big), driven by available cash.
  if (state.awaitingDealChoice) {
    const size = player.cash >= BIG_DEAL_CASH ? 'big' : 'small';
    return { method: 'chooseDeal', args: [size] };
  }

  // 6) A pending card needs resolution.
  if (state.pendingCard) {
    return resolveCard(state.pendingCard, player);
  }

  // 7) A pending Fast Track tile (investment / dream) needs buy or skip.
  if (state.pendingFastTrackTile) {
    return resolveFastTrackTile(state, state.pendingFastTrackTile, player);
  }

  // 8) Nothing left to do — let the runner end the turn.
  return null;
}

/** Pick the cheapest dream so it is the most attainable on the Fast Track. */
function pickDream(): string {
  const cheapest = [...DREAMS].sort((a, b) => a.cost - b.cost)[0];
  return (cheapest ?? DREAMS[0]).id;
}

/**
 * Card heuristic: buy affordable real estate / business that yields positive
 * monthly cash flow; never gamble on stocks / gold / MLM / lottery; skip
 * everything else. The engine keeps optional market-sale cards pending, so the
 * safe universal fallback is to skip.
 */
function resolveCard(card: Card, player: PublicPlayer): BotAction {
  const skip: BotAction = { method: 'cardAction', args: ['skip'] };

  if (card.type === 'realEstate') {
    const down = card.downPayment ?? 0;
    const cashFlow = card.cashFlow ?? 0;
    if (cashFlow > 0 && affordable(player, down)) {
      return { method: 'cardAction', args: ['buyRealEstate'] };
    }
    return skip;
  }

  if (card.type === 'business') {
    const down = card.downPayment ?? card.cost ?? 0;
    const cashFlow = card.cashFlow ?? 0;
    if (cashFlow > 0 && affordable(player, down)) {
      return { method: 'cardAction', args: ['buyBusiness'] };
    }
    return skip;
  }

  // stock / goldCoins / mlm / lottery / charity / market-sale cards: don't gamble.
  return skip;
}

/** Fast Track tile heuristic: buy affordable cash-flow investments; buy the
 *  bot's OWN dream if it can afford it (an instant win); otherwise skip. */
function resolveFastTrackTile(
  state: PublicGameState,
  tile: FastTrackTile,
  player: PublicPlayer
): BotAction {
  const skip: BotAction = { method: 'fastTrackAction', args: ['skip'] };

  if (tile.kind === 'investment') {
    const cost = tile.downPayment ?? tile.cost ?? 0;
    const cashFlow = tile.cashFlow ?? 0;
    if (cashFlow > 0 && player.cash >= cost) {
      return { method: 'fastTrackAction', args: ['buy'] };
    }
    return skip;
  }

  if (tile.kind === 'dream') {
    // Only the bot's own dream is buyable, and only if affordable (with markers).
    if (tile.id && player.dreamId === tile.id) {
      const dream = DREAMS.find((d) => d.id === tile.id);
      if (dream) {
        const markers = state.dreamMarkers[dream.id] ?? 0;
        const cost = dream.cost * (1 + markers);
        if (player.cash >= cost) return { method: 'fastTrackAction', args: ['buy'] };
      }
    }
    return skip;
  }

  return skip;
}

/** Keep a small cash cushion so a forced doodad/expense won't bankrupt the bot. */
function affordable(player: PublicPlayer, price: number): boolean {
  return player.cash - price >= LOW_CASH;
}

/** Decide whether a bot accepts a deal another player offered it: take it only if
 *  it yields positive monthly cash flow and the bot can afford the down payment
 *  while keeping its cash cushion. Same heuristic the bot uses for its own deals. */
export function acceptDealOffer(card: Card, player: PublicPlayer): boolean {
  const cashFlow = card.cashFlow ?? 0;
  const down = card.downPayment ?? card.cost ?? 0;
  return cashFlow > 0 && affordable(player, down);
}
