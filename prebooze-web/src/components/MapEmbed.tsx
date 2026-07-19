/** Keyless Google Maps embed — renders the pinned map for an address query.
 * Swaps to the Maps JavaScript API key (VITE_MAPS_KEY) with the backend if needed. */
export default function MapEmbed({ query, height = 220 }: { query: string; height?: number }) {
  const q = query.trim();
  if (!q) return null;
  return (
    <div className="field">
      <span>Map preview — how guests will find you</span>
      <iframe
        title={`Map — ${q}`}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`}
        style={{ width: '100%', height, border: '1px solid var(--border)', borderRadius: 10 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
