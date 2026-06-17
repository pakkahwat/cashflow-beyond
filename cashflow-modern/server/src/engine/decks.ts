import cardsData from '../data/cards.json';
import type { Card, Deck, DeckName } from './types.js';

const rawDeck = cardsData as unknown as Deck;

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * A draw-pile that reshuffles when exhausted. Single-card decks
 * (payday/charity/downsized/baby) always return their one card.
 */
class Pile {
  private source: Card[];
  private pile: Card[];

  constructor(cards: Card[]) {
    this.source = cards;
    this.pile = shuffle(cards);
  }

  draw(): Card {
    if (this.source.length <= 1) {
      return { ...this.source[0] };
    }
    if (this.pile.length === 0) {
      this.pile = shuffle(this.source);
    }
    return { ...this.pile.pop()! };
  }
}

export class Decks {
  private piles: Record<DeckName, Pile>;

  constructor() {
    this.piles = {
      smallDeal: new Pile(rawDeck.smallDeal),
      bigDeal: new Pile(rawDeck.bigDeal),
      doodad: new Pile(rawDeck.doodad),
      market: new Pile(rawDeck.market),
      payday: new Pile(rawDeck.payday),
      charity: new Pile(rawDeck.charity),
      downsized: new Pile(rawDeck.downsized),
      baby: new Pile(rawDeck.baby)
    };
  }

  draw(deck: DeckName): Card {
    return this.piles[deck].draw();
  }
}
