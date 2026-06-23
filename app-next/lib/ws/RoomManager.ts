import type { WebSocket } from 'ws';
import { Game } from '../../engine/Game.js';

export interface Room {
  code: string;
  game: Game;
  sockets: Map<WebSocket, string>; // ws -> playerId
  idleTimer?: ReturnType<typeof setTimeout>;
  /** Synthetic, server-created bot player ids (`bot:1..N`). Non-networked. */
  bots?: Set<string>;
  /** True once any bot has been added — Phase 4 records `vsBots = bots.size > 0`. */
  vsBots?: boolean;
  /** Active per-turn bot auto-play loop guard (prevents overlapping schedulers). */
  botRunning?: boolean;
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
