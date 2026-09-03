import { Clock } from 'lucide-react';
import type { VenueDayKey, VenueDayTiming, VenueTimingsByDay } from '../types';

const DAYS: { key: VenueDayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];
const DEFAULT_DAY: VenueDayTiming = { open: '18:00', close: '01:00', closed: false };

/** Per-day open/close hours, independent per weekday, with a "copy to all
 * days" shortcut on each row — replaces the old single free-text "Wed–Sun ·
 * 8 PM – 1 AM" string, which couldn't express different hours on different
 * days at all. Shared by VenueOnboarding.tsx and VenueListing.tsx (same
 * shape as prebooze-admin's TimingsEditor in Venues.tsx). */
export default function VenueTimingsEditor({ value, onChange }: { value: VenueTimingsByDay; onChange: (v: VenueTimingsByDay) => void }) {
  const dayVal = (k: VenueDayKey) => value[k] ?? DEFAULT_DAY;
  const setDay = (k: VenueDayKey, patch: Partial<VenueDayTiming>) => onChange({ ...value, [k]: { ...dayVal(k), ...patch } });
  const copyToAll = (k: VenueDayKey) => {
    const src = dayVal(k);
    const next: VenueTimingsByDay = {};
    for (const d of DAYS) next[d.key] = { ...src };
    onChange(next);
  };
  return (
    <div className="field">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Timings</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DAYS.map((d) => {
          const t = dayVal(d.key);
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 32, fontSize: 12.5, fontWeight: 700 }}>{d.label}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={t.closed} onChange={(e) => setDay(d.key, { closed: e.target.checked })} /> Closed
              </label>
              {!t.closed && (
                <>
                  <input type="time" style={{ padding: '4px 6px', fontSize: 12.5, width: 110 }} value={t.open} onChange={(e) => setDay(d.key, { open: e.target.value })} />
                  <span style={{ fontSize: 12 }}>–</span>
                  <input type="time" style={{ padding: '4px 6px', fontSize: 12.5, width: 110 }} value={t.close} onChange={(e) => setDay(d.key, { close: e.target.value })} />
                </>
              )}
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11.5 }} onClick={() => copyToAll(d.key)}>Copy to all days</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
