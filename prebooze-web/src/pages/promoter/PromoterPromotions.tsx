import { Link } from 'react-router-dom';

/** Events this promoter is approved to promote. Populated once organizers enable
 * promoter guest lists and add them (Phase 2). */
export default function PromoterPromotions() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>My promotions</h1>
      <div className="empty">
        <div style={{ fontSize: 30, marginBottom: 10 }}>📣</div>
        No events yet. Organizers invite promoters per event — once you're added to an event's
        promoter list it shows up here with your affiliate link and a live guest list.
        <div style={{ marginTop: 16 }}>
          <Link to="/browse" className="btn btn-ghost">Browse events in your city →</Link>
        </div>
      </div>
    </div>
  );
}
