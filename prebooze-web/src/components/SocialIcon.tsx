/** Real platform glyphs (inline SVG, currentColor) instead of two-letter
 * text abbreviations — used everywhere a profile shows social/website
 * links (organizer/promoter/lineup so far; venue has no real link data to
 * show yet). `platform` can be given directly, or left to be guessed from
 * a raw link string via `guessPlatform`. */
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

const PATHS: Record<SocialPlatform, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </>
  ),
  facebook: <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v3.5H8V21h3.5v-7.5h2.7l.5-3.5h-3.2V7.8c0-1 .3-1.7 1.7-1.7H15V3z" fill="currentColor" />,
  x: <path d="M4 3l7 8.5L4.3 21H7l5.3-6.2L16.5 21H20l-7.4-9L19.7 3H17l-4.9 5.7L8 3H4z" fill="currentColor" />,
  youtube: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9.5l6 2.5-6 2.5v-5z" fill="currentColor" />
    </>
  ),
  whatsapp: <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4.1-.1 0-.3 0-.4 0-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.3.1.2 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3z" fill="currentColor" />,
  website: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
};

export default function SocialIcon({ platform, size = 15 }: { platform: SocialPlatform; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[platform]}
    </svg>
  );
}
