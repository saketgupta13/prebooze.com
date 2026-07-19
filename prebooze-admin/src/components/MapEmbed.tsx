/** Keyless Google Maps embed — live pin preview for an address query. */
export default function MapEmbed({ query, height = 200 }: { query: string; height?: number }) {
  const q = query.trim().replace(/^,\s*|\s*,\s*$/g, '');
  if (!q || q.length < 4) return null;
  return (
    <iframe
      title={`Map — ${q}`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`}
      style={{ width: '100%', height, border: '1px solid var(--border, #333)', borderRadius: 10 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
