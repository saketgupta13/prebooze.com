import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { liveBroadcast, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Push notifications';

/** Admin-sent promotional/offer push to the guest app — real, targeted
 * at every guest who actually has the app installed (a real registered
 * push token), not every account on the platform. A send can't be
 * undone once it's gone out, so the audience count is shown live before
 * committing, and the final send requires an explicit confirm. */
export default function PushBroadcast() {
  const session = useLiveSession();
  const { token } = session;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [city, setCity] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [audience, setAudience] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    setAudienceLoading(true);
    const t = setTimeout(() => {
      liveBroadcast.audience(city.trim() || undefined)
        .then((r) => setAudience(r.count))
        .catch(() => setAudience(null))
        .finally(() => setAudienceLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [token, city]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const send = async () => {
    setErr('');
    if (!title.trim() || !message.trim()) { setErr('Title and message are required'); return; }
    const count = audience ?? 0;
    if (count === 0) { setErr('No guests match this audience — nothing to send'); return; }
    if (!window.confirm(`Send this push notification to ${count} guest${count === 1 ? '' : 's'} right now? This can't be undone.`)) return;
    setSending(true);
    setResult(null);
    try {
      const r = await liveBroadcast.send({ title: title.trim(), message: message.trim(), city: city.trim() || undefined, eventSlug: eventSlug.trim() || undefined });
      setResult(r.sent);
      setTitle('');
      setMessage('');
      setEventSlug('');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {result !== null && (
        <div className="card" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          Sent to {result} guest{result === 1 ? '' : 's'} ✓
        </div>
      )}

      <div className="page-hd">
        <h1 className="page-title">Push notifications</h1>
      </div>
      <div className="tiny hint" style={{ marginBottom: 10 }}>
        Sends a real push + in-app notification to guests who have the app installed. Respects each
        guest's own notification mute switch. Leave city blank to reach everyone; an event link is
        optional — tapping the notification opens that event's page.
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Title</div>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend offer!" maxLength={80} />
        </div>
        <div>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Message</div>
          <textarea
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. 20% off this weekend's events — book now on Prebooze"
            maxLength={200}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="tiny muted" style={{ marginBottom: 4 }}>City (optional)</div>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Nagpur — blank for all cities" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tiny muted" style={{ marginBottom: 4 }}>Event link (optional)</div>
            <input className="input" value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} placeholder="event slug" />
          </div>
        </div>

        <div className="tiny muted">
          {audienceLoading ? 'Checking audience…' : audience === null ? '—' : `Will reach ${audience} guest${audience === 1 ? '' : 's'}`}
        </div>

        <button type="button" className="btn btn-pri" disabled={sending || !title.trim() || !message.trim()} onClick={send} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Send size={14} /> {sending ? 'Sending…' : 'Send push notification'}
        </button>
      </div>
    </div>
  );
}
