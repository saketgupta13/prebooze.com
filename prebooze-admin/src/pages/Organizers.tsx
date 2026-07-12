import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { ORGANIZER_STATUS, Tag } from '../components/ui';

export default function Organizers() {
  const { organizers, setOrganizerStatus, removeOrganizer } = useAdmin();
  const [cityF, setCityF] = useState('All');
  const cities = ['All', ...new Set(organizers.map((o) => o.city).filter((c) => c !== '—'))];
  const navigate = useNavigate();
  const pending = organizers.filter((o) => o.status === 'pending').length;

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">Organizers</h1>
          {pending > 0 && (
            <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>
              {pending} awaiting review
            </span>
          )}
        </div>
        <Link to="/organizers/new" className="btn btn-pri">+ Add organizer</Link>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cities.map((c) => (
          <button key={c} className={`chip ${cityF === c ? 'on' : ''}`} onClick={() => setCityF(c)}>{c}</button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 680 }}>
          <span style={{ flex: 1.6 }}>Organizer</span>
          <span style={{ flex: 1.6 }}>Contact</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 0.8 }}>Events</span>
          <span style={{ flex: 1 }}>KYC</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.4 }} />
        </div>
        {(cityF === 'All' ? organizers : organizers.filter((o) => o.city === cityF)).map((o) => (
          <div
            key={o.id}
            className="trow clickable"
            style={{ minWidth: 680, background: o.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}
            onClick={() => navigate(`/organizers/${o.id}`)}
          >
            <span style={{ flex: 1.6, fontWeight: 700 }}>{o.name}</span>
            <span style={{ flex: 1.6 }} className="muted">{o.contact}</span>
            <span style={{ flex: 1 }} className="muted">{o.city}</span>
            <span style={{ flex: 0.8 }}>{o.events}</span>
            <span style={{ flex: 1 }} className="muted">{o.kyc}</span>
            <span style={{ flex: 1 }}><Tag {...ORGANIZER_STATUS[o.status]} /></span>
            <span style={{ flex: 1.4, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {o.status === 'pending' && (
                <>
                  <button
                    className="btn btn-pri btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrganizerStatus(o.id, 'approved');
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrganizerStatus(o.id, 'rejected');
                    }}
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                className="btn btn-danger btn-sm"
                style={{ padding: '2px 7px' }}
                title="Remove organizer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Remove ${o.name}? Their events stay but lose the link.`)) removeOrganizer(o.id);
                }}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">
        approving unlocks event creation for that organizer · rejecting keeps their account read-only · click a row to open its detail page
      </div>
    </div>
  );
}
