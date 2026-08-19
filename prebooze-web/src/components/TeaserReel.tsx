import ReelCard from './ReelCard';
import { classifyVideoLink, instagramEmbedUrl, youtubeEmbedUrl } from '../lib/videoLink';

/** Instagram's official embed.js widget needs a cross-origin postMessage
 * round-trip to resize itself, which is flaky outside a real logged-in
 * browser session (can silently render nothing, with no JS-visible error to
 * react to) — so this iframes Instagram's own canonical embed page directly
 * at a fixed size instead, the same way the YouTube case below does.
 * Whether Instagram actually renders the reel inside that iframe isn't
 * something we can detect (cross-origin — no access to the frame's
 * content), so the "open on Instagram" link stays visible underneath rather
 * than only appearing on a failure we can't reliably observe. */
function InstagramEmbed({ url, title }: { url: string; title: string }) {
  const embedSrc = instagramEmbedUrl(url);
  return (
    <div style={{ width: '100%', maxWidth: 328, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {embedSrc && (
        <div style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }}>
          <iframe src={embedSrc} title={title} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay; encrypted-media" />
        </div>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className={embedSrc ? 'tiny muted' : 'btn btn-ghost btn-sm'}>
        {embedSrc ? 'Open on Instagram ↗' : 'View reel on Instagram ↗'}
      </a>
    </div>
  );
}

/** A teaser reel can be a direct video file (poster-first tap-to-play, same
 * as Home's "Live reels"), a YouTube link (iframe embed), or an Instagram
 * Reel/post link (Instagram's own embed widget). Most organizers already
 * have their promo clip live on Instagram and paste that share link as-is
 * rather than re-hosting the file, so all three need to just work. */
export default function TeaserReel({ url, title, hue }: { url: string; title: string; hue: number }) {
  const kind = classifyVideoLink(url);

  if (kind === 'instagram') return <InstagramEmbed url={url} title={title} />;

  if (kind === 'youtube') {
    const embedSrc = youtubeEmbedUrl(url);
    if (embedSrc) {
      return (
        <div style={{ width: '100%', maxWidth: 260, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }}>
          <iframe
            src={embedSrc}
            title={title}
            style={{ width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    // A YouTube URL we couldn't parse a video id from (channel/playlist
    // link, most likely) — no embeddable video, so just link out instead of
    // trying (and failing) to play it as a direct file.
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
        View on YouTube ↗
      </a>
    );
  }

  return <ReelCard reel={{ id: title, title, hue, videoUrl: url, posterUrl: null }} />;
}
