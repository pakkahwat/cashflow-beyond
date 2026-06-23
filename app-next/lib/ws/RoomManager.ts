import type { WebSocket } from 'ws';
import { Game } from '../../engine/Game.js';

export interface Room {
  code: string;
  game: Game;
  sockets: Map<WebSocket, string>; // ws -> playerId
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
