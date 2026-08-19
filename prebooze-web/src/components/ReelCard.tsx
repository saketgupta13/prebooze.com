import { useState } from 'react';
import Poster from './Poster';

/** Poster-first, tap-to-play — a reel's actual video only starts
 * downloading once a guest taps it, instead of autoplaying (and fetching
 * the full video) the instant the surrounding page loads. posterUrl is a
 * real server-generated first-frame JPEG (see StorageService.processVideo);
 * reels published before that existed fall back to a tap-to-load play
 * button with no image. Shared by Home.tsx's "Live reels" strip and
 * EventDetail.tsx's per-event teaser, so both get the same UX. */
export default function ReelCard({ reel }: { reel: { id: string; title: string; hue: number; videoUrl: string | null; posterUrl: string | null } }) {
  const [playing, setPlaying] = useState(false);

  if (!reel.videoUrl) return <Poster hue={reel.hue} emoji="▶" label={reel.title} variant="reel" />;

  if (playing) {
    return (
      <video
        className="poster reel"
        src={reel.videoUrl}
        poster={reel.posterUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        title={reel.title}
      />
    );
  }

  return (
    <button
      type="button"
      className="poster reel reel-cover"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${reel.title}`}
      style={reel.posterUrl ? { backgroundImage: `url(${reel.posterUrl})` } : undefined}
    >
      <span className="reel-play">▶</span>
    </button>
  );
}
