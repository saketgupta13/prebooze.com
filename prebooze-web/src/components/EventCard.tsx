import { Link } from 'react-router-dom';
import type { Event } from '../types';
import { fmtDate, minPrice, venueById } from '../data/mock';
import { useApp } from '../store/AppContext';
import { friendsGoing, goingCount } from '../lib/social';
import Poster, { categoryEmoji } from './Poster';

export default function EventCard({ event }: { event: Event }) {
  const { following } = useApp();
  const venue = venueById(event.venueId);
  const soldOut = event.tiers.every((t) => t.sold >= t.quantity);
  const going = goingCount(event);
  const friendCount = friendsGoing(event.id, following).length;
  return (
    <Link to={`/events/${event.slug}`} className="ecard">
      <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="Poster 3:4" />
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
