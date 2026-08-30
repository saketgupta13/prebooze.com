import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GENDER_OPTIONS, fmtDate, fmtTime } from '../../data/mock';
import { catalog, promoter as promoterApi } from '../../api';
import { ApiError } from '../../api/client';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import Poster from '../../components/Poster';
import CategoryIcon from '../../components/CategoryIcon';
import Loader from '../../components/Loader';
import type { Event, PromoterProfile } from '../../types';
import { eventLocation } from '../../lib/venue';

/** Public guest-capture landing reached via a promoter's affiliate link.
 * No login — name / phone / age / gender → a time-based QR pass. All fraud/
 * quota/cap/cutoff checks happen server-side in POST /p/:eventSlug/:promoterSlug
 * (PromoterService.captureGuest) — this page just submits and shows whatever
 * real error comes back, rather than duplicating that logic client-side
 * against a local guess at the current list/quota state. */
export default function GuestLanding() {
  const { eventSlug, promoterSlug } = useParams();
  const [params] = useSearchParams();
  const via = params.get('via') ?? undefined; // sub-promoter handle (team link)
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [promoter, setPromoter] = useState<PromoterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventSlug || !promoterSlug) return;
    Promise.all([catalog.event(eventSlug), catalog.promoter(promoterSlug).catch(() => null)])
      .then(([e, p]) => { setEvent(e); setPromoter(p); })
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [eventSlug, promoterSlug]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  // Companions beyond the main signer — one combined QR covers the whole
  // party, the gate scans once and everyone checks in together.
  const [companions, setCompanions] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loader />;

  const cfg = event?.promoterConfig;
  const guestListPromoters = cfg?.guestListPromoters ?? cfg?.allowedPromoters ?? [];
  const active = !!cfg?.enabled && !!promoterSlug && guestListPromoters.includes(promoterSlug);

  if (!event || !active) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>This guest-list link isn't active</h1>
          <p className="muted" style={{ margin: '10px 0 20px' }}>
            The promoter list may be full, closed, or the link is invalid.
          </p>
          <Link to="/" className="btn btn-pri">Browse events instead</Link>
        </div>
      </main>
    );
  }

  const venue = event.venue;
  const cutoff = cutoffDate(event);
  const minAge = event.ageLimit.includes('21') ? 21 : event.ageLimit.includes('18') ? 18 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !age.trim() || !gender) {
      setErr('All fields are required — the gate checks these against your ID.');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const guest = await promoterApi.captureGuest(eventSlug!, promoterSlug!, {
        eventId: event.id, promoterSlug: promoterSlug!,
        name: name.trim(), phone: phone.trim(), age: age.trim(), gender, subPromoter: via,
        companions: companions.map((c) => c.trim()).filter(Boolean).map((c) => ({ name: c })),
      });
      navigate(`/pass/${guest.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card card-shadow">
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 76, flexShrink: 0 }}>
              <Poster hue={event.posterHue} icon={<CategoryIcon name={event.category} />} imageUrl={event.posterUrl} alt={event.title} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="badge badge-accent">Free entry 🎟️</span>
              <h1 style={{ fontSize: 20, margin: '6px 0 2px' }}>{event.title}</h1>
              <div className="muted small">{fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, venue)}</div>
            </div>
          </div>

          <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
            You're on <b>{promoter?.name ?? promoterSlug}</b>'s guest list
            {via && <> <span className="muted">(via {via})</span></>}.{' '}
            {cutoff && (
              <>
                Free entry <b>before {cutoff.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b> —
                closes in <b className="accent">{countdownLabel(cutoff)}</b>.
              </>
            )}
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As on your ID" autoFocus />
            </div>
            <div className="field">
              <span>WhatsApp number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" inputMode="tel" />
            </div>
            <div className="form-row">
              <div className="field">
                <span>Age</span>
                <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={minAge ? `${minAge}+` : 'Age'} />
              </div>
              <div className="field">
                <span>Gender</span>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <span>Bringing anyone else? (optional)</span>
              <div className="tiny muted-2" style={{ marginBottom: 8 }}>
                One combined QR covers your whole group — the gate scans it once for everyone.
              </div>
              {companions.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={c}
                    onChange={(e) => setCompanions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder="Guest's full name"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCompanions((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {companions.length < 9 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompanions((prev) => [...prev, ''])}>
                  + Add another guest
                </button>
              )}
            </div>

            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <button className="btn btn-pri btn-block btn-lg" disabled={submitting}>
              {submitting ? 'Joining…' : companions.filter((c) => c.trim()).length > 0 ? `Get our free-entry QR (${1 + companions.filter((c) => c.trim()).length}) →` : 'Get my free-entry QR →'}
            </button>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 your QR is sent to WhatsApp &amp; email · valid only before the cutoff · carry ID matching your name
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
