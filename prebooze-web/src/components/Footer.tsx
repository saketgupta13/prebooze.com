import { Link } from 'react-router-dom';
import { SOCIAL_LINKS } from '../data/mock';

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr-cols">
          <div>
            <h4>Explore</h4>
            <Link to="/browse">Events</Link>
            <Link to="/venues">Venues</Link>
            <Link to="/organizers/livewire">Organizers</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/browse">Cities</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About us</Link>
            <Link to="/host">Host with us</Link>
            <Link to="/contact">Careers</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <div>
            <h4>Support</h4>
            <Link to="/faqs">FAQs</Link>
            <Link to="/legal/refund-policy">Refund policy</Link>
            <Link to="/legal/terms">Terms</Link>
            <Link to="/legal/privacy">Privacy</Link>
          </div>
          <div>
            <h4>Follow</h4>
            {SOCIAL_LINKS.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </div>
        <div className="ftr-base">
          <img src="/prebooze-logo.png" alt="" />
          <span>© 2026 Prebooze Inc. · All rights reserved</span>
          <span style={{ flex: 1 }} />
          <Link to="/legal/guest-policy">Guest policy</Link>
          <Link to="/legal/organizer-policy">Organizer policy</Link>
          <Link to="/legal/disclaimer">Disclaimer</Link>
        </div>
      </div>
    </footer>
  );
}
