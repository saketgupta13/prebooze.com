import { Music, Laugh, PartyPopper, Disc3, Home, Guitar, Sparkles, Wrench, Tag as TagIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Real icons for event categories — mirrors prebooze-web's CategoryIcon.tsx
 * (same reasoning as CityIcon: a free-text emoji field on EventCategory.icon
 * can't guarantee a consistent look). Keyed on category name, generic Tag
 * fallback for anything not in this curated list. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Concerts: Music,
  Comedy: Laugh,
  Festivals: PartyPopper,
  'Club nights': Disc3,
  'House parties': Home,
  Jamming: Guitar,
  Party: Sparkles,
  Workshop: Wrench,
};

export default function CategoryIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? TagIcon;
  return <Icon size={size} className={className} />;
}
