import { useEffect, useState } from 'react';
import { liveTestimonials, LiveApiError, type LiveTestimonial } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Testimonials';
const Star = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--green)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);

/** Home-page testimonials — real Testimonial rows. */
export default function Testimonials() {
  const session = useLiveSession();
  const { token } = session;

  const [testimonials, setTestimonials] = useState<LiveTestimonial[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<LiveTestimonial | null>(null);
  const [author, setAuthor] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveTestimonials.list().then(setTestimonials).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const reset = () => { setEditing(null); setAuthor(''); setLocation(''); setRating(5); setQuote(''); };
  const startEdit = (t: LiveTestimonial) => {
    setEditing(t);
    setAuthor(t.author);
    setLocation(t.location);
    setRating(t.rating);
    setQuote(t.quote);
    window.scrollTo(0, 0);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !quote.trim()) { setErr('Author and quote are required'); return; }
    try {
      if (editing) await liveTestimonials.update(editing.id, { author: author.trim(), location: location.trim(), rating, quote: quote.trim() });
      else await liveTestimonials.create({ author: author.trim(), location: location.trim(), rating, quote: quote.trim() });
      reset();
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  const toggleFeatured = async (t: LiveTestimonial) => {
    try { await liveTestimonials.update(t.id, { featured: !t.featured }); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Remove this testimonial?')) return;
    try { await liveTestimonials.remove(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const featuredCount = testimonials.filter((t) => t.featured).length;

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Testimonials</h1>
        <span className="chip">{featuredCount} featured on home</span>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        featured testimonials appear in the "Happy guests" section on the guest home page
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={save}>
        <div className="display" style={{ fontWeight: 700 }}>{editing ? `Edit — ${editing.author}` : 'Add testimonial'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Author</label>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <label>Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin" />
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Rating</label>
            <select className="input" value={rating} onChange={(e) => setRating(+e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Quote</label>
          <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={220} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-pri btn-sm">{editing ? 'Save changes ✓' : 'Add testimonial'}</button>
          {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="stack" style={{ gap: 8 }}>
        {testimonials.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5 }}>
                <b>{t.author}</b> <span className="muted">· {t.location || '—'}</span> · <Star n={t.rating} />
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>"{t.quote}"</div>
            </div>
            <button className={`chip ${t.featured ? 'on' : ''}`} style={{ fontSize: 10.5 }} onClick={() => toggleFeatured(t)}>
              {t.featured ? '★ Featured' : 'Feature'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>✎</button>
            <button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>✕</button>
          </div>
        ))}
        {testimonials.length === 0 && !loading && <div className="card muted small">No testimonials yet.</div>}
      </div>
    </div>
  );
}
