import { Music, Laugh, PartyPopper, Disc3, Home, Guitar, Sparkles, Wrench, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Real icons for event categories — replaces the admin-typed emoji on
 * `EventCategory.icon`, same reasoning as CityIcon.tsx: a free-text emoji
 * field can't guarantee a consistent, professional look, and admin staff
 * shouldn't need to hand-pick a good emoji for every category they create.
 * Keyed on category name (not the DB icon field), with a generic Tag
 * fallback for anything not in this curated list — covers what's actually
 * in use today plus the common ones admin staff are likely to add. */
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
  const Icon = CATEGORY_ICONS[name] ?? Tag;
  return <Icon size={size} className={className} />;
}
