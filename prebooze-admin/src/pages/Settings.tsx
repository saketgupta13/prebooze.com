import { useAdmin } from '../store/AdminContext';
import SeoFields from '../components/SeoFields';
import type { Settings as SettingsType } from '../types';

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: '1px solid ' + (on ? 'var(--green)' : 'rgba(139,195,74,.35)'),
        background: on ? 'var(--green)' : 'transparent',
        position: 'relative',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? 'var(--on-green)' : 'var(--muted)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 180 }}>
        {label}
        {hint && <span className="tiny hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/** Platform settings — referenced in the wireframe sidebar but never designed; specced here. */
export default function Settings() {
  const { settings, updateSettings, toast } = useAdmin();
  const set = (patch: Partial<SettingsType>) => updateSettings(patch);

  return (
    <div className="stack fade" style={{ maxWidth: 640, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Settings</h1>
        <button className="btn btn-pri" onClick={() => toast('Settings saved ✓')}>Save changes</button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Platform defaults</div>
        <Row label="Booking fee (per ticket)" hint="used by every event's fee preview">
          <span className="muted">₹</span>
          <input
            className="input"
            style={{ width: 70, textAlign: 'center' }}
            value={String(settings.bookingFee)}
            onChange={(e) => set({ bookingFee: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
          />
        </Row>
        <Row label="GST on platform fee">
          <input
            className="input"
            style={{ width: 70, textAlign: 'center' }}
            value={String(settings.gstPct)}
            onChange={(e) => set({ gstPct: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
          />
          <span className="muted">%</span>
        </Row>
        <Row label="Fee shown to guest as">
          <input
            className="input"
            style={{ width: 180 }}
            value={settings.feeLabel}
            onChange={(e) => set({ feeLabel: e.target.value })}
          />
        </Row>
        <Row label="Fee absorbed by default">
          {(['Organizer', 'Guest', 'Split'] as const).map((o) => (
            <button key={o} className={`chip ${settings.absorbedBy === o ? 'on' : ''}`} onClick={() => set({ absorbedBy: o })}>
              {o}
            </button>
          ))}
        </Row>
        <div className="tiny hint">commission has no global default — it's set per event in the event editor</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Payouts</div>
        <Row label="Payout day" hint="organizer payouts batch weekly">
          <select className="input" style={{ width: 140 }} value={settings.payoutDay} onChange={(e) => set({ payoutDay: e.target.value })}>
            {['Monday', 'Wednesday', 'Friday'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Row>
        <Row label="Auto-run payout batch" hint="skip manual “Run payout batch” each week">
          <Toggle on={settings.autoPayout} onChange={() => set({ autoPayout: !settings.autoPayout })} />
        </Row>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Notifications</div>
        <Row label="Weekly summary email to owner">
          <Toggle on={settings.weeklyEmail} onChange={() => set({ weeklyEmail: !settings.weeklyEmail })} />
        </Row>
        <Row label="WhatsApp alerts" hint="refund requests, KYC submissions, payout failures">
          <Toggle on={settings.whatsappAlerts} onChange={() => set({ whatsappAlerts: !settings.whatsappAlerts })} />
        </Row>
        <Row label="Require 2FA for team sign-in">
          <Toggle on={settings.require2fa} onChange={() => set({ require2fa: !settings.require2fa })} />
        </Row>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Social media accounts</div>
        <div className="tiny hint" style={{ marginTop: -8 }}>linked in the guest site footer and ticket emails</div>
        {(
          [
            ['instagram', 'Instagram'],
            ['x', 'X (Twitter)'],
            ['youtube', 'YouTube'],
            ['whatsapp', 'WhatsApp channel'],
            ['facebook', 'Facebook'],
          ] as const
        ).map(([key, label]) => (
          <Row key={key} label={label}>
            <input
              className="input"
              style={{ maxWidth: 300 }}
              value={settings.socials[key]}
              onChange={(e) => set({ socials: { ...settings.socials, [key]: e.target.value } })}
              placeholder={`${key}.com/prebooze`}
            />
          </Row>
        ))}
      </div>

      <SeoFields
        seo={settings.siteSeo}
        onChange={(next) => set({ siteSeo: next })}
        slug="/"
        fallbackTitle="Prebooze — Your city's events, one tap away"
      />
      <div className="tiny hint" style={{ marginTop: -8 }}>website-wide SEO defaults — pages, events and blogs without their own SEO fall back to these</div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Contact details</div>
        <div className="tiny hint" style={{ marginTop: -8 }}>shown on the guest Contact page and booking confirmations</div>
        <Row label="Support email">
          <input className="input" style={{ maxWidth: 300 }} value={settings.contact.email} onChange={(e) => set({ contact: { ...settings.contact, email: e.target.value } })} />
        </Row>
        <Row label="WhatsApp / phone">
          <input className="input" style={{ maxWidth: 300 }} value={settings.contact.phone} onChange={(e) => set({ contact: { ...settings.contact, phone: e.target.value } })} />
        </Row>
        <Row label="Organizer support email">
          <input className="input" style={{ maxWidth: 300 }} value={settings.contact.organizerEmail} onChange={(e) => set({ contact: { ...settings.contact, organizerEmail: e.target.value } })} />
        </Row>
        <Row label="Office address">
          <input className="input" style={{ maxWidth: 300 }} value={settings.contact.address} onChange={(e) => set({ contact: { ...settings.contact, address: e.target.value } })} />
        </Row>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Footer</div>
        <Row label="Copyright text" hint="shown at the bottom of every guest page">
          <input className="input" style={{ maxWidth: 340 }} value={settings.footerCopyright} onChange={(e) => set({ footerCopyright: e.target.value })} />
        </Row>
      </div>

      <div className="card" style={{ borderColor: 'rgba(255,107,94,.35)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700, color: 'var(--red)' }}>Danger zone</div>
        <Row label="Maintenance mode" hint="guest site shows a “back soon” page; bookings pause">
          <Toggle
            on={settings.maintenanceMode}
            onChange={() => {
              set({ maintenanceMode: !settings.maintenanceMode });
              toast(settings.maintenanceMode ? 'Maintenance mode off — site live ✓' : 'Maintenance mode ON — guest bookings paused');
            }}
          />
        </Row>
        <Row label="Pause all ticket sales" hint="every live event stops selling until resumed">
          <button className="btn btn-danger btn-sm" onClick={() => toast('All ticket sales paused')}>Pause all</button>
        </Row>
      </div>
    </div>
  );
}
