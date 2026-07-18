import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS } from '../data/mock';
import EventCard from '../components/EventCard';

/** Saved events — the guest's wishlist. */
export default function Wishlist() {
  const { wishlist, myEvents } = useApp();
  const all = [...myEvents, ...EVENTS];
  const saved = wishlist.map((id) => all.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Wishlist
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>My wishlist ❤️</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Events you've saved for later — tap the heart on any event to add it here.
        </p>

        {saved.length === 0 ? (
          <div className="empty">
            Nothing saved yet. <Link to="/browse" className="link">Browse events →</Link>
          </div>
        ) : (
          <div className="grid-4">
            {saved.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </div>
    </main>
  );
}
