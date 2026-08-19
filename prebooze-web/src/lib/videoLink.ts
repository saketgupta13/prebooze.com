/** Classifies a pasted teaser-reel link so EventDetail can render the right
 * player — most organizers already have their promo clip posted on
 * Instagram or YouTube and will paste that share link as-is, not a raw
 * video file URL. */
export type VideoLinkKind = 'instagram' | 'youtube' | 'direct';

export function classifyVideoLink(url: string): VideoLinkKind {
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\./, '');
    if (host === 'instagram.com') return 'instagram';
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
    return 'direct';
  } catch {
    return 'direct';
  }
}

/** Instagram's embeddable URL is strictly `/{reel|p|tv}/{shortcode}/embed/`
 * — its embed route 404s (and the resulting redirect to instagram.com/
 * denies framing entirely) on any other shape, including the very common
 * username-prefixed permalink Instagram itself shows in the share sheet:
 * instagram.com/<username>/reel/<shortcode>/. So this pulls the shortcode
 * out of the path regardless of what's around it, rather than trusting
 * whatever shape was pasted. Returns null for a profile/home link with no
 * post in it. */
export function instagramEmbedUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const kind = match[1] === 'reels' ? 'reel' : match[1];
    return `https://www.instagram.com/${kind}/${match[2]}/embed/captioned`;
  } catch {
    return null;
  }
}

/** Handles youtube.com/watch?v=, youtu.be/<id>, youtube.com/shorts/<id>,
 * and youtube.com/embed/<id> — returns null (falls back to a plain link)
 * for anything else, e.g. a channel or playlist URL. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
    else if (host === 'youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] ?? null;
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] ?? null;
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
