// Crisp board-tile icons from lucide-react (replaces flat emoji).
// `name` is a Rat Race tile type OR a Fast Track tile kind.
import {
  Briefcase,
  Banknote,
  TrendingUp,
  ShoppingBag,
  HeartHandshake,
  TrendingDown,
  Baby,
  Flag,
  Coins,
  Building2,
  Star,
  TriangleAlert
} from 'lucide-react';

const MAP: Record<string, any> = {
  // Rat Race
  deal: Briefcase,
  payday: Banknote,
  market: TrendingUp,
  doodad: ShoppingBag,
  charity: HeartHandshake,
  downsized: TrendingDown,
  baby: Baby,
  start: Flag,
  // Fast Track
  cashflowDay: Coins,
  investment: Building2,
  dream: Star,
  loss: TriangleAlert
};

export default function TileIcon({ name, size = 26 }: { name: string; size?: number }) {
  const Icon = MAP[name] ?? Briefcase;
  return (
    <Icon
      size={size}
      color="#eef2ff"
      strokeWidth={2}
      style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.5))' }}
    />
  );
}
