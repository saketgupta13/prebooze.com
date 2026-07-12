import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import type { Testimonial } from '../types';

const Star = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--green)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);

/** Home-page testimonials — "happy user reviews" curated by admin. */
export default function Testimonials() {
  const { testimonials, addTestimonial, updateTestimonial, removeTestimonial, toast } = useAdmin();
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [author, setAuthor] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');

  const reset = () => {
    setEditing(null);
    setAuthor('');
    setLocation('');
    setRating(5);
    setQuote('');
  };
  const startEdit = (t: Testimonial) => {
    setEditing(t);
    setAuthor(t.author);
    setLocation(t.location);
    setRating(t.rating);
    setQuote(t.quote);
    window.scrollTo(0, 0);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !quote.trim()) {
      toast('Author and quote are required');
      return;
    }
    if (editing) {
      updateTestimonial(editing.id, { author: author.trim(), location: location.trim(), rating, quote: quote.trim() });
    } else {
      addTestimonial({ id: 't' + Date.now(), author: author.trim(), location: location.trim(), rating, quote: quote.trim(), featured: true });
    }
    reset();
  };

  const featuredCount = testimonials.filter((t) => t.featured).length;

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <div className="page-hd">
        <h1 className="page-title">Testimonials</h1>
        <span className="chip">{featuredCount} featured on home</span>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        featured testimonials appear in the “Happy guests” section on the guest home page
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
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n}★</option>
              ))}
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
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>“{t.quote}”</div>
            </div>
            <button
              className={`chip ${t.featured ? 'on' : ''}`}
              style={{ fontSize: 10.5 }}
              onClick={() => updateTestimonial(t.id, { featured: !t.featured })}
            >
              {t.featured ? '★ Featured' : 'Feature'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>✎</button>
            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Remove this testimonial?')) removeTestimonial(t.id); }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
