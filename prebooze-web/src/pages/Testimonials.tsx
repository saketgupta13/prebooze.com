import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TESTIMONIALS } from '../data/mock';
import { content } from '../api';
import { isBackendEnabled } from '../api/client';
import type { CmsTestimonial } from '../types';
import Stars from '../components/Stars';

/** All guest testimonials, filterable by city — real GET /testimonials
 * (admin's Content > Testimonials), not the hardcoded mock array. */
export default function Testimonials() {
  const [live, setLive] = useState<CmsTestimonial[] | null>(null);
  const loading = isBackendEnabled() && live === null;
  useEffect(() => {
    if (!isBackendEnabled()) return;
    content.testimonials().then(setLive).catch(() => setLive([]));
  }, []);
  const all = live ?? (isBackendEnabled() ? [] : TESTIMONIALS);

  const cities = ['All', ...Array.from(new Set(all.map((t) => t.location)))];
  const [cityF, setCityF] = useState('All');
  const list = all.filter((t) => cityF === 'All' || t.location === cityF);
  const avg = all.length ? (all.reduce((a, t) => a + t.rating, 0) / all.length).toFixed(1) : '—';

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Reviews
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Happy guests 💚</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          {loading ? 'Loading…' : <><b className="accent">{avg}★</b> average from {all.length}+ verified guests across the network.</>}
        </p>
        <div className="chip-row" style={{ marginBottom: 18 }}>
          {cities.map((c) => (
            <button key={c} className={`chip ${cityF === c ? 'on' : ''}`} onClick={() => setCityF(c)}>{c}</button>
          ))}
        </div>

        <div className="grid-3">
          {list.map((t) => (
            <div key={t.id} className="card">
              <Stars rating={t.rating} />
              <p style={{ margin: '10px 0 12px', fontSize: 14 }}>"{t.quote}"</p>
              <div className="small bold">
                {t.author} <span className="muted-2" style={{ fontWeight: 400 }}>· {t.location}</span>
              </div>
            </div>
          ))}
        </div>
        {!loading && list.length === 0 && <div className="empty">No reviews from {cityF} yet.</div>}
      </div>
    </main>
  );
}
