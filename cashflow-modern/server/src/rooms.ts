import { customAlphabet } from 'nanoid';
import { Game } from './engine/Game.js';

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

class RoomManager {
  private rooms = new Map<string, Game>();

  create(): Game {
    let id = makeCode();
    while (this.rooms.has(id)) id = makeCode();
    const game = new Game(id);
    this.rooms.set(id, game);
    return game;
  }

  get(id: string): Game | undefined {
    return this.rooms.get(id.toUpperCase());
  }

  delete(id: string): void {
    this.rooms.delete(id);
  }

  /** Drop games that are empty (all players disconnected) and idle. */
  cleanup(): void {
    for (const [id, game] of this.rooms) {
      if (game.players.length === 0 || game.players.every((p) => !p.connected)) {
        this.rooms.delete(id);
      }
    }
  }
}

export const rooms = new RoomManager();
