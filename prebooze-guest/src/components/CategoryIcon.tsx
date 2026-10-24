import { Disc3, GraduationCap, Guitar, Home, Laugh, Music, PartyPopper, Sparkles, Tag } from 'lucide-react-native';

/** Same curated category→icon map as prebooze-web's CategoryIcon.tsx. */
const CATEGORY_ICONS: Record<string, typeof Tag> = {
  Concerts: Music,
  Comedy: Laugh,
  Festivals: PartyPopper,
  'Club nights': Disc3,
  'House parties': Home,
  Jamming: Guitar,
  Party: Sparkles,
  Workshop: GraduationCap,
};

export default function CategoryIcon({ name, size = 18, color }: { name: string; size?: number; color: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Tag;
  return <Icon size={size} color={color} />;
}
