import { Link } from 'react-router-dom';
import type { Event } from '../types';
import { fmtDate, minPrice, venueById } from '../data/mock';
import { useApp } from '../store/AppContext';
import { friendsGoing, goingCount } from '../lib/social';
import { isFeatured } from '../lib/featured';
import Poster, { categoryEmoji } from './Poster';

export default function EventCard({ event }: { event: Event }) {
  const { following, featured, wishlist, toggleWishlist } = useApp();
  const venue = venueById(event.venueId);
  const soldOut = event.tiers.every((t) => t.sold >= t.quantity);
  const going = goingCount(event);
  const friendCount = friendsGoing(event.id, following).length;
  const feat = isFeatured(featured, 'event', event.id);
  const saved = wishlist.includes(event.id);
  return (
    <Link to={`/events/${event.slug}`} className="ecard" style={{ position: 'relative', ...(feat ? { borderColor: 'var(--accent)' } : {}) }}>
      {feat && <span className="badge badge-accent" style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, zIndex: 2 }}>★ Featured</span>}
      <button
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(event.id); }}
        style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {saved ? '❤️' : '🤍'}
      </button>
      <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="Poster 3:4" imageUrl={event.posterUrl} />
      <div>
        <h3>{event.title}</h3>
        <div className="meta">
          {fmtDate(event.date)} · {venue?.name ?? 'TBA'}
        </div>
        {going > 0 && (
          <div className="tiny" style={{ margin: '2px 0 4px', color: friendCount ? 'var(--accent)' : 'var(--muted-2)' }}>
            🔥 {going.toLocaleString('en-IN')} going{friendCount > 0 && ` · ${friendCount} friend${friendCount > 1 ? 's' : ''}`}
          </div>
        )}
        <div className="row">
          <span className="price">from ₹{minPrice(event)}</span>
          <span className={`btn btn-sm ${soldOut ? 'btn-ghost' : 'btn-pri'}`}>
            {soldOut ? 'Sold out' : 'Book now'}
          </span>
        </div>
      </div>
    </Link>
  );
}
