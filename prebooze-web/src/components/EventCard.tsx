import { Link } from 'react-router-dom';
import type { Event } from '../types';
import { fmtDate, fmtTime } from '../data/mock';
import { useApp } from '../store/AppContext';
import { goingCount, showGoing } from '../lib/social';
import { isFeatured } from '../lib/featured';
import { eventCity, eventPath } from '../lib/urls';
import { formatFromPrice } from '../lib/formatPrice';
import { displayMinPrice, hasCurrentlyPaidTier } from '../lib/ticketTierPricing';
import Poster, { categoryEmoji } from './Poster';

export default function EventCard({ event }: { event: Event }) {
  const { featured, wishlist, toggleWishlist, city } = useApp();
  // Falls back to the currently-browsed city only in the (shouldn't-happen)
  // case an event has neither a venue nor privateCity set — every real
  // event has exactly one of the two per the schema's own invariant.
  const linkCity = eventCity(event) ?? city;
  // An event that's already happened can't be booked regardless of how
  // much inventory technically remains — reuses the same "sold out" pill
  // rather than a separate label, since both mean the same thing to a
  // guest: no button here will get you a ticket.
  const eventOver = new Date(event.date).getTime() < Date.now();
  const soldOut = eventOver || event.tiers.every((t) => t.sold >= t.quantity);
  const going = goingCount(event);
  const feat = isFeatured(featured, 'event', event.id);
  const saved = wishlist.includes(event.id);
  return (
    <Link to={eventPath(linkCity, event.slug)} className="ecard" style={{ position: 'relative', ...(feat ? { borderColor: 'var(--accent)' } : {}) }}>
      {feat && <span className="badge badge-accent" style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, zIndex: 2 }}>★ Featured</span>}
      <button
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        title={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(event.id); }}
        style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {saved ? '❤️' : '🤍'}
      </button>
      <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="Poster 3:4" imageUrl={event.posterUrl} alt={event.title} />
      <div className="ecard-body">
        <h3>{event.title}</h3>
        <div className="meta">
          {fmtDate(event.date)}, {fmtTime(event.date)} · {event.durationHrs} hrs
        </div>
        <div className="going">
          {showGoing(event) && <>🔥 {going.toLocaleString('en-IN')} going</>}
        </div>
        <div className="row">
          <span className="price">{formatFromPrice(displayMinPrice(event.tiers, event.date), hasCurrentlyPaidTier(event.tiers, event.date))}</span>
          <span className={`btn btn-sm ${soldOut ? 'btn-ghost' : 'btn-pri'}`}>
            {soldOut ? 'Sold out' : 'Book now'}
          </span>
        </div>
      </div>
    </Link>
  );
}
