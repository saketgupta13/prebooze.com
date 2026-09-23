import { useEffect, useMemo, useState } from 'react';
import { Kpi, SearchBox, Drawer } from '../components/ui';
import { liveSupportTickets, LiveApiError, type HelpTicket } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { CheckCircle2, Send, X, Mail } from 'lucide-react';

const TITLE = 'Support tickets';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Real admin queue for HelpTicket — didn't exist at all before this (a
 * ticket got created, but no admin surface could ever see or reply to one;
 * built off a real user-reported ticket that got no visible response
 * anywhere). List + drawer detail with the full thread, a reply box, and a
 * status toggle. */
export default function SupportTickets() {
  const session = useLiveSession();
  const { token } = session;

  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HelpTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    liveSupportTickets
      .list(status)
      .then(setTickets)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tickets;
    const q = query.toLowerCase();
    return tickets.filter((t) => t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.user?.name ?? t.name ?? '').toLowerCase().includes(q));
  }, [tickets, query]);

  const openCount = tickets.filter((t) => t.status === 'open').length;

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const openTicket = (id: string) => {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    liveSupportTickets
      .get(id)
      .then(setDetail)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load ticket'))
      .finally(() => setDetailLoading(false));
  };

  const sendReply = async () => {
    if (!reply.trim() || !detail) return;
    setSending(true);
    setErr('');
    try {
      const r = await liveSupportTickets.reply(detail.id, reply.trim());
      setDetail({ ...detail, replies: [...(detail.replies ?? []), r] });
      setReply('');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async () => {
    if (!detail) return;
    const next = detail.status === 'open' ? 'resolved' : 'open';
    try {
      const updated = await liveSupportTickets.setStatus(detail.id, next);
      setDetail({ ...detail, status: updated.status });
      setTickets((prev) => prev.map((t) => (t.id === detail.id ? { ...t, status: updated.status } : t)));
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update status');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Support tickets</h1>
      </div>

      <div className="kpi-grid">
        <Kpi label="Open" value={String(openCount)} />
        <Kpi label="Total" value={String(tickets.length)} />
      </div>

      <div className="tabs">
        <button className={status === 'open' ? 'on' : ''} onClick={() => setStatus('open')}>Open</button>
        <button className={status === 'resolved' ? 'on' : ''} onClick={() => setStatus('resolved')}>Resolved</button>
        <button className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>All</button>
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder="subject / ticket id / name…" style={{ maxWidth: 320 }} />

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 720 }}>
          <span style={{ flex: 1.4 }}>From</span>
          <span style={{ flex: 1.8 }}>Subject</span>
          <span style={{ flex: 1 }}>Topic</span>
          <span style={{ flex: 0.7 }}>Raised</span>
          <span style={{ flex: 0.6 }}>Replies</span>
          <span style={{ flex: 0.8 }}>Status</span>
        </div>
        {filtered.map((t) => (
          <div key={t.id} className="trow" style={{ minWidth: 720, cursor: 'pointer' }} onClick={() => openTicket(t.id)}>
            <span style={{ flex: 1.4 }}>
              <b>{t.user?.name || t.name || 'Guest'}</b>
              <span className="tiny muted" style={{ display: 'block' }}>{t.user?.phone || t.email || '—'} · {t.role}</span>
            </span>
            <span style={{ flex: 1.8 }}>{t.subject} <span className="tiny muted">· {t.id}</span></span>
            <span style={{ flex: 1 }} className="tiny muted">{t.topic}</span>
            <span style={{ flex: 0.7 }} className="tiny muted">{timeAgo(t.createdAt)}</span>
            <span style={{ flex: 0.6 }} className="tiny muted">{t._count?.replies ?? 0}</span>
            <span style={{ flex: 0.8 }}>
              {t.status === 'open' ? (
                <span className="tag" style={{ borderColor: 'var(--border)' }}>open</span>
              ) : (
                <span className="tag" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>resolved</span>
              )}
            </span>
          </div>
        ))}
        {filtered.length === 0 && !loading && <div className="trow muted">No {status === 'all' ? '' : status} tickets match.</div>}
      </div>

      {openId && (
        <Drawer onClose={() => setOpenId(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="display" style={{ fontWeight: 700 }}>{openId}</div>
            <X size={18} style={{ cursor: 'pointer' }} onClick={() => setOpenId(null)} />
          </div>

          {detailLoading || !detail ? (
            <div className="tiny muted">Loading…</div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{detail.subject}</div>
                <div className="tiny muted">{detail.topic} · {detail.user?.name || detail.name} · {detail.user?.phone || ''}</div>
                {(detail.user?.email || detail.email) ? (
                  <div className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Mail size={11} /> {detail.user?.email || detail.email}
                  </div>
                ) : (
                  <div className="tiny" style={{ color: 'var(--red)', marginTop: 2 }}>No email on file — this guest won't get an email reply</div>
                )}
              </div>

              <div className="card" style={{ background: 'var(--bg)' }}>{detail.message}</div>

              {(detail.replies ?? []).map((r) => (
                <div key={r.id} className="card" style={{ background: r.fromStaffId ? 'rgba(139,195,74,.08)' : 'var(--bg)' }}>
                  <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 4 }}>
                    {r.fromStaffId ? `Staff${r.fromStaff?.name ? ` · ${r.fromStaff.name}` : ''}` : 'Guest'} · {timeAgo(r.createdAt)}
                  </div>
                  {r.message}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  className="input"
                  style={{ flex: 1, minHeight: 70 }}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply — sends a real email to the guest…"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={toggleStatus} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={13} /> Mark as {detail.status === 'open' ? 'resolved' : 'open'}
                </button>
                <button className="btn btn-pri btn-sm" disabled={sending || !reply.trim()} onClick={sendReply} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Send size={13} /> Send reply
                </button>
              </div>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
