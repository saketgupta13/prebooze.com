import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2, XCircle, Ticket, Banknote, Star, ShieldCheck, RotateCcw, ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { organizer, type OrgNotification } from '../api';
import { notificationWebPath } from '../lib/notificationNav';

// Same icon-per-kind mapping as prebooze-organizer's NotificationsScreen.tsx,
// adapted to web's accent/danger/warn CSS variables instead of RN's colors.ts.
const KIND_ICON: Record<string, { Icon: LucideIcon; cls: string }> = {
  approved: { Icon: CheckCircle2, cls: 'nb-icon-success' },
  rejected: { Icon: XCircle, cls: 'nb-icon-danger' },
  booking: { Icon: Ticket, cls: 'nb-icon-accent' },
  payout: { Icon: Banknote, cls: 'nb-icon-success' },
  review: { Icon: Star, cls: 'nb-icon-warn' },
  team: { Icon: ShieldCheck, cls: 'nb-icon-accent' },
  refund: { Icon: RotateCcw, cls: 'nb-icon-danger' },
  cart: { Icon: ShoppingCart, cls: 'nb-icon-warn' },
};

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Bell icon + dropdown for the organizer console — ports prebooze-organizer's
 * NotificationsScreen.tsx to web. Polls unread-count so the badge stays live
 * without needing the panel open. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<OrgNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = () => {
    organizer.unreadNotificationCount().then((r) => setUnread(r.count)).catch(() => {});
  };

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    organizer.notifications().then(setRows).catch(() => setRows([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAllRead = () => {
    organizer.markAllNotificationsRead().then(() => {
      setRows((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
      setUnread(0);
    }).catch(() => {});
  };

  const onRowClick = (n: OrgNotification) => {
    if (!n.read) {
      organizer.markNotificationRead(n.id).catch(() => {});
      setRows((prev) => prev?.map((r) => (r.id === n.id ? { ...r, read: true } : r)) ?? null);
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    const path = notificationWebPath(n.to);
    if (path) navigate(path);
  };

  return (
    <div className="nb-wrap" ref={ref}>
      <button className="nb-bell" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu nb-panel" onClick={(e) => e.stopPropagation()}>
          <div className="nb-panel-head">
            <span className="hdr-menu-cap" style={{ padding: 0 }}>Notifications</span>
            {unread > 0 && <button className="nb-mark-all" onClick={markAllRead}>Mark all read</button>}
          </div>
          {rows === null ? (
            <div className="tiny muted nb-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="tiny muted nb-empty">Nothing here yet — you'll see updates like event approvals here.</div>
          ) : (
            rows.map((n) => {
              const kind = KIND_ICON[n.icon] ?? { Icon: Ticket, cls: 'nb-icon-muted' };
              const { Icon, cls } = kind;
              return (
                <button key={n.id} className={`nb-row ${n.read ? '' : 'nb-row-unread'}`} onClick={() => onRowClick(n)}>
                  <span className={`nb-icon ${cls}`}><Icon size={15} /></span>
                  <span className="nb-row-body">
                    <span className="nb-row-text">{n.text}</span>
                    <span className="tiny muted">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="nb-dot" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
