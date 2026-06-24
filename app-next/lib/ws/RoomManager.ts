import type { WebSocket } from 'ws';
import { Game } from '../../engine/Game.js';

export interface Room {
  code: string;
  game: Game;
  sockets: Map<WebSocket, string>; // ws -> playerId
  idleTimer?: ReturnType<typeof setTimeout>;
  /** Synthetic, server-created bot player ids (`bot:1..N`). Non-networked. */
  bots?: Set<string>;
  /** Real (human) player ids who turned on Auto-play; the runner plays their turns
   *  with the same heuristic as bots until they switch it off. */
  autoPlayers?: Set<string>;
  /** True once any bot has been added — Phase 4 records `vsBots = bots.size > 0`. */
  vsBots?: boolean;
  /** Active per-turn bot auto-play loop guard (prevents overlapping schedulers). */
  botRunning?: boolean;
  /** Guard while a bot is scheduled to answer a deal offered to it (out of turn). */
  botOfferPending?: boolean;
  /** Unix ms when the game transitioned from lobby → active. Set on startGame. */
  startedAt?: number;
  /** True once the finished-game stats have been written to MongoDB (idempotency guard). */
  recorded?: boolean;
}

/** In-memory registry of active rooms. One process owns all rooms; nothing is
 *  persisted, so a server restart drops in-progress games (accepted per spec). */
export class RoomManager {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getOrCreate(code: string): Room {
    let room = this.rooms.get(code);
    if (!room) {
      room = { code, game: new Game(code), sockets: new Map() };
      this.rooms.set(code, room);
    }
    return room;
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }
}

export const rooms = new RoomManager();
