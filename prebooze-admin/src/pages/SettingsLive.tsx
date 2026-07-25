import { useEffect, useState } from 'react';
import { liveSettings, LiveApiError, type LiveSettings } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Settings (live)';

/** Real PlatformSettings row — the same table already toggled directly via
 * API earlier for coming-soon mode now has a real UI. Every field here is
 * read by the real guest site (usePlatformInfo) or backend (booking fee/GST
 * computation, maintenance gate, sales-pause check) — nothing decorative. */
export default function SettingsLive() {
  const session = useLiveSession();
  const { token } = session;

  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    liveSettings
      .get()
      .then(setSettings)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;
  if (!settings) return loading ? <div className="tiny muted">Loading…</div> : null;

  const set = <K extends keyof LiveSettings>(key: K, value: LiveSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const updated = await liveSettings.update(settings);
      setSettings(updated);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 700 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Platform mode</div>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.comingSoonMode} onChange={(e) => set('comingSoonMode', e.target.checked)} />
          <span>Coming soon mode — public sees a takeover page, staff can bypass</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} />
          <span>Maintenance mode — "back soon" page for everyone, no staff bypass</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.salesPaused} onChange={(e) => set('salesPaused', e.target.checked)} />
          <span>Pause all ticket sales platform-wide</span>
        </label>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Booking &amp; fees</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 120 }}>
            <label>Booking fee ₹</label>
            <input className="input" inputMode="numeric" value={settings.bookingFee} onChange={(e) => set('bookingFee', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="field" style={{ width: 100 }}>
            <label>GST %</label>
            <input className="input" inputMode="numeric" value={settings.gstPct} onChange={(e) => set('gstPct', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Fee label</label>
            <input className="input" value={settings.feeLabel} onChange={(e) => set('feeLabel', e.target.value)} />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Absorbed by</label>
            <select className="input" value={settings.absorbedBy} onChange={(e) => set('absorbedBy', e.target.value)}>
              <option value="Guest">Guest</option>
              <option value="Organizer">Organizer</option>
              <option value="Split">Split</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Payouts &amp; notifications</div>
        <div className="field" style={{ width: 140 }}>
          <label>Payout day</label>
          <input className="input" value={settings.payoutDay} onChange={(e) => set('payoutDay', e.target.value)} placeholder="e.g. Friday" />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.autoPayout} onChange={(e) => set('autoPayout', e.target.checked)} />
          <span>Auto-run payout batch on payout day</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.weeklyEmail} onChange={(e) => set('weeklyEmail', e.target.checked)} />
          <span>Weekly summary email</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.whatsappAlerts} onChange={(e) => set('whatsappAlerts', e.target.checked)} />
          <span>WhatsApp alerts for staff</span>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.require2fa} onChange={(e) => set('require2fa', e.target.checked)} />
          <span>Require 2FA for staff login</span>
        </label>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Footer</div>
        <div className="field">
          <label>Footer copyright</label>
          <input className="input" value={settings.footerCopyright} onChange={(e) => set('footerCopyright', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-pri" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save settings'}</button>
        {saved && <span className="tiny" style={{ color: 'var(--green)' }}>Saved ✓</span>}
      </div>
    </div>
  );
}
