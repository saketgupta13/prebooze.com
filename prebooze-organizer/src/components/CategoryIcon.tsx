/** Ported verbatim from prebooze-web/src/components/CategoryIcon.tsx (same
 * lucide set, both packages). */
import { Disc3, GraduationCap, Guitar, Home, Laugh, type LucideIcon, Music, PartyPopper, Sparkles, Tag } from 'lucide-react-native';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Concerts: Music,
  Comedy: Laugh,
  Festivals: PartyPopper,
  'Club nights': Disc3,
  'House parties': Home,
  Jamming: Guitar,
  Party: Sparkles,
  Workshop: GraduationCap,
};

export default function CategoryIcon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Tag;
  return <Icon size={size} color={color} />;
}
