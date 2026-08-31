import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Drawer } from './ui';
import { X, Check, ArrowRight, PartyPopper } from 'lucide-react';

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAdmin();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Drawer onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b className="display" style={{ fontSize: 15 }}>
          Notifications {unread > 0 && <span className="red">({unread} new)</span>}
        </b>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><X size={18} /></span>
      </div>
      {unread > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={markAllNotificationsRead}>
          Mark all read <Check size={14} />
        </button>
      )}
      <div className="stack" style={{ gap: 6 }}>
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              markNotificationRead(n.id);
              if (n.to) {
                navigate(n.to);
                onClose();
              }
            }}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              textAlign: 'left',
              background: n.read ? 'transparent' : 'rgba(139,195,74,.08)',
              border: `1px solid ${n.read ? 'rgba(139,195,74,.15)' : 'rgba(139,195,74,.35)'}`,
              borderRadius: 8,
              padding: '9px 10px',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, flex: 'none' }}>{n.icon}</span>
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, display: 'block' }}>{n.text}</span>
              <span className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {n.time}{n.to ? <> · tap to open <ArrowRight size={11} /></> : ''}
              </span>
            </span>
            {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flex: 'none', marginTop: 4 }} />}
          </button>
        ))}
        {notifications.length === 0 && (
          <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            All caught up <PartyPopper size={15} />
          </div>
        )}
      </div>
      <div className="tiny hint">approvals, refunds, KYC, licenses and payouts land here · WhatsApp alerts mirror these (Settings)</div>
    </Drawer>
  );
}
