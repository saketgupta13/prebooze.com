// Loading placeholder shown while an async directory section's own fetch is
// still in flight — same footprint as the real DirectoryCard, so nothing
// shifts once real data replaces it.
export default function DirectoryCardSkeleton() {
  return (
    <div className="card skel-pulse" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="skel-bar" style={{ width: 46, height: 46, borderRadius: '50%' }} />
      <div className="skel-bar" style={{ width: '70%', height: 15, marginTop: 10 }} />
      <div className="skel-bar" style={{ width: '45%', height: 11, marginTop: 8 }} />
      <div className="skel-bar" style={{ width: '100%', height: 11, marginTop: 10 }} />
      <div className="skel-bar" style={{ width: '80%', height: 11, marginTop: 6 }} />
      <div className="skel-bar" style={{ width: '55%', height: 11, marginTop: 10 }} />
      <div className="skel-bar" style={{ width: '100%', height: 32, marginTop: 14, borderRadius: 8 }} />
    </div>
  );
}
