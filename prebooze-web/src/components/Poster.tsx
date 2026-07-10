interface Props {
  hue: number;
  emoji?: string;
  label?: string;
  variant?: 'portrait' | 'landscape' | 'square' | 'reel';
  className?: string;
}

/** Branded placeholder block — the wireframes specify gray placeholders;
 * we render dark gradient art blocks until real photography is sourced. */
export default function Poster({ hue, emoji = '🎶', label, variant = 'portrait', className = '' }: Props) {
  const cls = variant === 'portrait' ? '' : variant;
  return (
    <div
      className={`poster ${cls} ${className}`}
      style={{
        background: `radial-gradient(ellipse at 30% 25%, hsla(${hue}, 70%, 55%, 0.32), transparent 60%),
          radial-gradient(ellipse at 75% 80%, hsla(${(hue + 60) % 360}, 65%, 45%, 0.22), transparent 55%),
          var(--surface-2)`,
      }}
    >
      <span>{emoji}</span>
      {label && <span className="poster-label">{label}</span>}
    </div>
  );
}

export const categoryEmoji = (category: string) =>
  ({
    Concerts: '🎸',
    Comedy: '🎤',
    Festivals: '🎪',
    'This weekend': '🌇',
  })[category] ?? '🎶';
