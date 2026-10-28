import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { liveBroadcast, LiveApiError } from '../lib/liveApi';
import type { LiveBroadcastAudienceType, LiveBroadcastLog } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Push notifications';

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Admin-sent promotional/offer push to the guest app — real, targeted
 * at every guest who actually has the app installed (a real registered
 * push token), not every account on the platform. A send can't be
 * undone once it's gone out, so the audience count is shown live before
 * committing, and the final send requires an explicit confirm. Three
 * audience types: by city (or blank for everyone), by people who've
 * wishlisted/shown interest in a specific event, or by followers of a
 * specific organizer/venue/lineup (followeeKey, same format Follow uses
 * elsewhere — bare id, "venue:id" or "lineup:slug"). A future
 * scheduledFor is logged and picked up later by CronService.broadcastTick
 * instead of sending immediately. */
export default function PushBroadcast() {
  const session = useLiveSession();
  const { token } = session;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState<LiveBroadcastAudienceType>('city');
  const [city, setCity] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [followeeKey, setFoloweeKey] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [audience, setAudience] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ sent: number; scheduled: boolean } | null>(null);
  const [history, setHistory] = useState<LiveBroadcastLog[]>([]);

  const loadHistory = () => {
    liveBroadcast.history().then(setHistory).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setAudienceLoading(true);
    const t = setTimeout(() => {
      liveBroadcast.audience({ audienceType, city: city.trim() || undefined, eventSlug: eventSlug.trim() || undefined, followeeKey: followeeKey.trim() || undefined })
        .then((r) => setAudience(r.count))
        .catch(() => setAudience(null))
        .finally(() => setAudienceLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [token, audienceType, city, eventSlug, followeeKey]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const scheduledMs = scheduledFor ? new Date(scheduledFor).getTime() : 0;
  const isFuture = scheduledMs > Date.now();

  const send = async () => {
    setErr('');
    if (!title.trim() || !message.trim()) { setErr('Title and message are required'); return; }
    if (audienceType === 'event' && !eventSlug.trim()) { setErr('Event slug is required for this audience'); return; }
    if (audienceType === 'follow' && !followeeKey.trim()) { setErr('Followee key is required for this audience'); return; }
    const count = audience ?? 0;
    if (count === 0) { setErr('No guests match this audience — nothing to send'); return; }
    const confirmMsg = isFuture
      ? `Schedule this push for ${new Date(scheduledFor).toLocaleString()}, reaching ${count} guest${count === 1 ? '' : 's'}?`
      : `Send this push notification to ${count} guest${count === 1 ? '' : 's'} right now? This can't be undone.`;
    if (!window.confirm(confirmMsg)) return;
    setSending(true);
    setResult(null);
    try {
      const r = await liveBroadcast.send({
        title: title.trim(),
        message: message.trim(),
        audienceType,
        city: audienceType === 'city' ? city.trim() || undefined : undefined,
        eventSlug: audienceType !== 'city' ? eventSlug.trim() || undefined : undefined,
        followeeKey: audienceType === 'follow' ? followeeKey.trim() || undefined : undefined,
        scheduledFor: isFuture ? new Date(scheduledFor).toISOString() : undefined,
      });
      setResult(r);
      setTitle('');
      setMessage('');
      setEventSlug('');
      setFoloweeKey('');
      setScheduledFor('');
      loadHistory();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 640 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {result !== null && (
        <div className="card" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          {result.scheduled ? 'Scheduled ✓' : `Sent to ${result.sent} guest${result.sent === 1 ? '' : 's'} ✓`}
        </div>
      )}

      <div className="page-hd"><h1 className="page-title">Push notifications</h1></div>
      <div className="tiny hint" style={{ marginBottom: 10 }}>
        Sends a real push + in-app notification to guests who have the app installed. Respects each
        guest's own notification mute switch.
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Title</div>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend offer!" maxLength={80} />
        </div>
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Message</div>
          <textarea className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. 20% off this weekend's events — book now on Prebooze" maxLength={200} rows={3} style={{ resize: 'vertical' }} />
        </div>

        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Audience</div>
          <select className="input" value={audienceType} onChange={(e) => setAudienceType(e.target.value as LiveBroadcastAudienceType)}>
            <option value="city">By city (or everyone)</option>
            <option value="event">People interested in a specific event</option>
            <option value="follow">Followers of an organizer / venue / lineup</option>
          </select>
        </div>

        {audienceType === 'city' && (
          <div>
            <div className="tiny muted" style={{ marginBottom: 4 }}>City (optional)</div>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Nagpur — blank for all cities" />
          </div>
        )}
        {audienceType === 'event' && (
          <div>
            <div className="tiny muted" style={{ marginBottom: 4 }}>Event slug</div>
            <input className="input" value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} placeholder="event slug — reaches wishlisted/interested guests" />
          </div>
        )}
        {audienceType === 'follow' && (
          <div>
            <div className="tiny muted" style={{ marginBottom: 4 }}>Followee key</div>
            <input className="input" value={followeeKey} onChange={(e) => setFoloweeKey(e.target.value)} placeholder="organizer id, venue:id, or lineup:slug" />
          </div>
        )}
        {audienceType === 'follow' && (
          <div>
            <div className="tiny muted" style={{ marginBottom: 4 }}>Event link on tap (optional)</div>
            <input className="input" value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} placeholder="event slug" />
          </div>
        )}

        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Send at (optional — blank sends now)</div>
          <input className="input" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
        </div>

        <div className="tiny muted">
          {audienceLoading ? 'Checking audience…' : audience === null ? '—' : `Will reach ${audience} guest${audience === 1 ? '' : 's'}`}
        </div>

        <button type="button" className="btn btn-pri" disabled={sending || !title.trim() || !message.trim()} onClick={send} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Send size={14} /> {sending ? 'Sending…' : isFuture ? 'Schedule push notification' : 'Send push notification'}
        </button>
      </div>

      <div className="page-hd" style={{ marginTop: 20 }}><h2 className="page-title" style={{ fontSize: 16 }}>History</h2></div>
      {history.length === 0 && <div className="card tiny muted" style={{ textAlign: 'center' }}>No broadcasts sent yet</div>}
      <div className="stack" style={{ gap: 8 }}>
        {history.map((h) => {
          const audienceLabel = h.audienceType === 'city' ? (h.city || 'All cities') : h.audienceType === 'event' ? `Interested in: ${h.eventSlug}` : `Follows: ${h.followeeKey}`;
          const reach = h.status === 'scheduled' ? h.audienceCount : h.sentCount;
          const statusColor = h.status === 'sent' ? 'var(--green)' : h.status === 'scheduled' ? 'var(--amber, #c9a227)' : 'var(--red)';
          return (
            <div key={h.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 700 }}>{h.title}</div>
                <span className="tag" style={{ borderColor: statusColor, color: statusColor, flexShrink: 0 }}>{h.status}</span>
              </div>
              <div className="tiny muted">{h.message}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 2 }}>
                <span className="tag" style={{ borderColor: 'var(--border)' }}>{audienceLabel}</span>
                <span className="tiny muted">{reach} guest{reach === 1 ? '' : 's'}</span>
                <span className="tiny muted">
                  {h.status === 'scheduled' && h.scheduledFor ? `due ${new Date(h.scheduledFor).toLocaleString()}` : h.sentAt ? timeAgo(h.sentAt) : timeAgo(h.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
