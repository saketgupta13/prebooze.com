import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TESTIMONIALS } from '../data/mock';
import Stars from '../components/Stars';

/** All guest testimonials, filterable by city. */
export default function Testimonials() {
  const cities = ['All', ...Array.from(new Set(TESTIMONIALS.map((t) => t.location)))];
  const [cityF, setCityF] = useState('All');
  const list = TESTIMONIALS.filter((t) => cityF === 'All' || t.location === cityF);
  const avg = (TESTIMONIALS.reduce((a, t) => a + t.rating, 0) / TESTIMONIALS.length).toFixed(1);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Reviews
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Happy guests 💚</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          <b className="accent">{avg}★</b> average from {TESTIMONIALS.length}+ verified guests across the network.
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
        {list.length === 0 && <div className="empty">No reviews from {cityF} yet.</div>}
      </div>
    </main>
  );
}
