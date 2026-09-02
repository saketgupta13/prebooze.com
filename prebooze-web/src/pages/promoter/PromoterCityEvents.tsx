import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime } from '../../data/mock';
import { promoter as promoterApi, type PromoterMe } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import { copyToClipboard } from '../../lib/clipboard';
import { absoluteUrl, eventPath } from '../../lib/urls';
import { Globe, CheckCircle2, Link2, ExternalLink, Percent } from 'lucide-react';

interface CityEvent {
  id: string; slug: string; title: string; posterUrl: string | null; date: string; durationHrs: number;
  city: string; organizerName: string | null; minPrice: number;
}

/** Prebooze's own promoter-referral program (2026-09-02) — every live event
 * in this promoter's city, completely separate from PromoterPromotions.tsx
 * (which only lists events an organizer has opted this promoter into).
 * Generate a ?ref= link for ANY event here; a paid booking through it earns
 * 2% of Prebooze's own commission — no organizer involved, no free-list
 * mode, paid tickets only. Deliberately its own page rather than folded
 * into "My promotions" so the two money sources (organizer-funded vs
 * Prebooze-funded) never get visually conflated. */
export default function PromoterCityEvents() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    Promise.all([promoterApi.me(), promoterApi.cityEvents()])
      .then(([m, e]) => { setMe(m); setEvents(e); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err && !me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>;

  const mySlug = me?.slug ?? '';
  const copy = async (link: string, key: string) => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } else {
      setErr('Could not copy — long-press or select the link below to copy it manually');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Promote any event</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Every live event in {me?.city || 'your city'} — no organizer invite needed. Share your link for any of them;
        when someone books a paid ticket through it, Prebooze pays you 2% of what Prebooze itself earns from that
        sale. Free tickets and guest lists don't count here — paid sales only.
      </p>
      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

      {events.length === 0 ? (
        <div className="empty">
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Globe size={30} /></div>
          No live events in {me?.city || 'your city'} right now — check back once one's on sale.
        </div>
      ) : (
        <div className="stack" style={{ display: 'grid', gap: 12 }}>
          {events.map((e) => {
            const link = `${absoluteUrl(eventPath(e.city, e.slug))}?ref=${mySlug}`;
            return (
              <div key={e.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 16 }}>{e.title}</h3>
                    <div className="muted small">
                      {fmtDate(e.date)} · {fmtTime(e.date)} · {e.city}
                      {e.organizerName && <> · {e.organizerName}</>}
                    </div>
                    <div className="tiny muted-2" style={{ marginTop: 2 }}>{e.minPrice > 0 ? `from ₹${e.minPrice}` : 'Free onwards'}</div>
                  </div>
                  <span className="badge badge-accent" style={{ height: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Percent size={12} /> 2% on paid sales</span>
                </div>

                <div className="hr" />

                <div className="tiny muted-2" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Link2 size={12} /> Your link — send this out, you earn on any paid ticket booked through it
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn-pri btn-sm" onClick={() => copy(link, e.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {copied === e.id ? <><CheckCircle2 size={13} /> Copied</> : <><Link2 size={13} /> Copy my link</>}
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Preview link <ExternalLink size={13} /></a>
                  <Link to={eventPath(e.city, e.slug)} className="btn btn-ghost btn-sm">View event</Link>
                </div>
                <div className="tiny muted-2" style={{ marginTop: 6, wordBreak: 'break-all' }}>{link}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
