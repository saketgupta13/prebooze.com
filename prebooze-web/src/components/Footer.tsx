import { Link } from 'react-router-dom';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { useApp } from '../store/AppContext';
import { useCityList } from '../lib/useCityList';
import { cityBrowse, cityCategories, cityVenues, cityOrganizers, cityPromoters, cityLineups } from '../lib/urls';

// Admin only ever types "instagram.com/prebooze"-style handles, not always
// the full "https://…" — a bare domain in an <a href> is a relative URL
// (resolves against prebooze.com itself, not the real destination), so this
// normalizes it into a real, working external link either way. Trimmed
// first — a stray copy-pasted leading/trailing space fails the scheme
// check silently and ends up baked into the URL itself.
const withScheme = (url: string) => {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export default function Footer() {
  const { socials, footerCopyright, logoUrl } = usePlatformInfo();
  const { city } = useApp();
  // Real, crawlable <a href> per city (via <Link>, not CityPicker's
  // onClick-only buttons) — the only internal-link signal reinforcing
  // sitemap.xml for any city other than the one currently being viewed.
  // Same cached city list CityScope already fetches on every page load
  // (see useCityList's own doc comment), so this adds no extra request.
  // Automatically covers any future city, no manual update needed.
  const { cities } = useCityList();
  const socialList = [
    { label: 'Instagram', url: socials.instagram },
    { label: 'Facebook', url: socials.facebook },
    { label: 'X', url: socials.x },
    { label: 'YouTube', url: socials.youtube },
    { label: 'WhatsApp', url: socials.whatsapp },
  ]
    .filter((s) => s.url?.trim())
    .map((s) => ({ ...s, url: withScheme(s.url) }));

  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr-cols">
          <div>
            <h3>Explore</h3>
            <Link to={cityBrowse(city)}>Events</Link>
            <Link to={cityCategories(city)}>Browse by category</Link>
            <Link to={cityVenues(city)}>Venues</Link>
            <Link to={cityOrganizers(city)}>Organizers</Link>
            <Link to={cityPromoters(city)}>Promoters</Link>
            <Link to={cityLineups(city)}>Line-ups</Link>
            <Link to="/blog">Blog</Link>
          </div>
          <div>
            <h3>Company</h3>
            <Link to="/about">About us</Link>
            <Link to="/host">Host with us</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <div>
            <h3>Support</h3>
            <Link to="/help">Help center</Link>
            <Link to="/faqs">FAQs</Link>
            <Link to="/legal/refund-policy">Refund policy</Link>
            <Link to="/legal/terms">Terms</Link>
            <Link to="/legal/privacy">Privacy</Link>
          </div>
          <div>
            <h3>Follow</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {socialList.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  title={s.label}
                  aria-label={s.label}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--border-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {s.label === 'Instagram' ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.5" /><circle cx="17.8" cy="6.2" r="1.2" fill="currentColor" stroke="none" /></svg>
                  ) : s.label === 'Facebook' ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4V14h2.7v8h3.4z" /></svg>
                  ) : s.label === 'X' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.3L1.6 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20z" /></svg>
                  ) : s.label === 'YouTube' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.6A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.6 8.9.6 8.9.6s7 0 8.9-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7L15.9 12l-6.1 3.3z" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 3.5 17.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1a16 16 0 0 1-6.9-6c-.5-.9-.9-2-.6-2.9.1-.5.6-1.2 1-1.4.3-.1.6-.1.8 0 .2.1.5 1 .6 1.3.1.2.1.5 0 .7l-.4.7c-.1.2-.2.4 0 .7a10 10 0 0 0 1.7 2.2c.7.7 1.5 1.2 2.3 1.5.3.1.5.1.7-.1l.6-.7c.2-.2.4-.3.7-.2.3.1 1.6.8 1.8.9.2.1.4.2.4.4.1.2.1.9 0 1.6z" /></svg>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
        {cities && cities.length > 0 && (
          <div className="ftr-cities">
            <span className="ftr-cities-label">Explore other cities:</span>
            {cities.map((c) => (
              <Link key={c.name} to={cityBrowse(c.name)}>{c.name}</Link>
            ))}
          </div>
        )}
        <div className="ftr-base">
          <img src={logoUrl || '/prebooze-logo.png'} alt="" />
          <span>{footerCopyright}</span>
          <span className="ftr-spacer" />
          <Link to="/legal/guest-policy">Guest policy</Link>
          <Link to="/legal/organizer-policy">Organizer policy</Link>
          <Link to="/legal/purchase-terms">Purchase terms</Link>
          <Link to="/legal/disclaimer">Disclaimer</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
