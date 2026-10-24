import { Ionicons } from '@expo/vector-icons';

/** Real platform glyphs instead of lucide's generic Link2/AtSign stand-ins
 * (lucide-react-native has no brand icons) — mirrors prebooze-web's
 * SocialIcon.tsx + guessPlatform 1:1 via Ionicons' logo-* set, which Expo
 * ships for free. */
export type SocialPlatform = 'instagram' | 'facebook' | 'x' | 'youtube' | 'whatsapp' | 'website';

export function guessPlatform(link: string): SocialPlatform {
  const l = link.toLowerCase();
  if (l.includes('instagram') || l.startsWith('ig/')) return 'instagram';
  if (l.includes('facebook') || l.startsWith('fb/')) return 'facebook';
  if (l.includes('x.com') || l.includes('twitter') || l.startsWith('x/')) return 'x';
  if (l.includes('youtube') || l.startsWith('yt/')) return 'youtube';
  if (l.includes('wa.me') || l.includes('whatsapp') || l.startsWith('wa/')) return 'whatsapp';
  return 'website';
}

const ION_NAME: Record<SocialPlatform, keyof typeof Ionicons.glyphMap> = {
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  x: 'logo-twitter',
  youtube: 'logo-youtube',
  whatsapp: 'logo-whatsapp',
  website: 'globe-outline',
};

export default function SocialIcon({ platform, size = 16, color = '#fff' }: { platform: SocialPlatform; size?: number; color?: string }) {
  return <Ionicons name={ION_NAME[platform]} size={size} color={color} />;
}
