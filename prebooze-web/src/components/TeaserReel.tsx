import ReelCard from './ReelCard';
import { classifyVideoLink, instagramEmbedUrl, youtubeEmbedUrl } from '../lib/videoLink';

/** Instagram's public embed has no chrome-free mode — the iframe always
 * carries their own post card (profile header, likes/comments row), by
 * design, for attribution. Rather than let that white, Instagram-styled
 * card float directly on this page's dark background (looks like a foreign
 * element dropped in place), it sits inside our own dark, rounded frame —
 * reads as a deliberate module, the same way a printed photo sits in a
 * mat and frame instead of loose on the wall. Uses Instagram's own
 * canonical embed page directly (skipping their embed.js widget, which
 * needs a cross-origin postMessage round-trip to resize and is flaky
 * outside a real logged-in browser session) at a fixed size instead, the
 * same way the YouTube case below does. */
function InstagramEmbed({ url, title }: { url: string; title: string }) {
  const embedSrc = instagramEmbedUrl(url);
  if (!embedSrc) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
        View reel on Instagram ↗
      </a>
    );
  }
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 300,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-m)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Not locked to the 9:16 video aspect ratio like the direct-file/
          YouTube cases — Instagram's card includes its header and
          like/comment row above and below the video, so a strict video-only
          box would clip that content. This height comfortably fits a
          typical reel's card without an internal scrollbar for most posts. */}
      <div style={{ width: '100%', height: 540, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
        <iframe src={embedSrc} title={title} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay; encrypted-media" />
      </div>
      {/* Whether Instagram actually rendered the reel inside that iframe
          isn't something we can detect (cross-origin — no access to the
          frame's content), so this stays visible either way rather than
          only appearing on a failure we can't reliably observe. */}
      <a href={url} target="_blank" rel="noopener noreferrer" className="tiny muted" style={{ textAlign: 'center' }}>
        Open on Instagram ↗
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
