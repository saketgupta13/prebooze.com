import { useEffect, useState } from 'react';
import { ImageIcon, Upload, Clapperboard } from 'lucide-react';
import { RealUploadBox, RealVideoUploadBox } from './RealUploadBox';
import { ApiError } from '../api/client';
import { fmtMoney } from '../data/mock';
import type { Event as PbEvent, PlacementRates } from '../types';

const DAYS = [3, 7, 15, 30] as const;
type Days = (typeof DAYS)[number];

/** Shared by organizer/Marketing.tsx and venue/VenueMarketing.tsx — buy a
 * hero-banner or reel marketing slot for one of the caller's own events.
 * Deliberately minimal per Saket's call: just the event, the duration tier,
 * and the raw creative (a banner image, or a reel video/link same as
 * Event.teaserVideoUrl's own upload-or-link pattern) — no heading/
 * description/CTA fields here at all, admin fills those in at review time
 * (MarketingService.adminActivatePlacement). No concurrency limit either
 * (an organizer/venue can run several of these at once) and no slot cap —
 * see this feature's own planning discussion. */
export default function PlacementPurchaseCard({
  productType,
  events,
  rates,
  upload,
  onBuy,
}: {
  productType: 'banner' | 'reel';
  events: PbEvent[];
  rates: PlacementRates | null;
  upload: (file: File) => Promise<{ url: string; posterUrl?: string }>;
  onBuy: (eventId: string, days: Days, creativeUrl: string, creativePosterUrl?: string) => Promise<void>;
}) {
  const [eventId, setEventId] = useState('');
  const [days, setDays] = useState<Days>(7);
  const [creativeUrl, setCreativeUrl] = useState<string | null>(null);
  const [creativePosterUrl, setCreativePosterUrl] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const rate = (d: Days) => (rates ? (d === 3 ? rates.day3 : d === 7 ? rates.day7 : d === 15 ? rates.day15 : rates.day30) : 0);
  const total = (d: Days) => {
    const r = rate(d);
    return r + Math.round((r * (rates?.gstPct ?? 0)) / 100);
  };

  const buy = async () => {
    setErr('');
    if (!eventId) return setErr('Pick an event first');
    if (!creativeUrl) return setErr(productType === 'banner' ? 'Upload a banner image first' : 'Upload or link a video first');
    setBusy(true);
    try {
      await onBuy(eventId, days, creativeUrl, creativePosterUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not start payment — try again');
    } finally {
      setBusy(false);
    }
  };

  const title = productType === 'banner' ? 'Hero banner' : 'Reel marketing';
  const blurb = productType === 'banner'
    ? "Your event in the rotating banner at the top of that city's homepage."
    : 'Your event as a tap-to-play reel on the homepage, with a "Book now" link.';

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        {productType === 'banner' ? <ImageIcon size={16} className="muted" /> : <Clapperboard size={16} className="muted" />}
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <p className="muted small" style={{ marginTop: 4, marginBottom: 14 }}>{blurb}</p>

      {events.length === 0 ? (
        <p className="muted small">No upcoming events to promote yet.</p>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 10 }}>
            <span>Event</span>
            <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <span>{productType === 'banner' ? 'Banner image · 16:5' : 'Video · 9:16'}</span>
            {productType === 'banner' ? (
              <RealUploadBox
                value={creativeUrl}
                onChange={setCreativeUrl}
                upload={upload}
                onBusyChange={setUploading}
                label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> upload banner image</span>}
              />
            ) : (
              <>
                <RealVideoUploadBox
                  value={creativeUrl}
                  onChange={(url) => { setCreativeUrl(url); }}
                  upload={async (file) => {
                    const r = await upload(file);
                    setCreativePosterUrl(r.posterUrl);
                    return r;
                  }}
                  onBusyChange={setUploading}
                  label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> upload video</span>}
                />
                <input
                  className="input"
                  placeholder="or paste a link — Instagram Reel, YouTube, or a direct video file"
                  value={creativeUrl ?? ''}
                  onChange={(e) => { setCreativeUrl(e.target.value || null); setCreativePosterUrl(undefined); }}
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <span>Duration</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${days === d ? 'on' : ''}`}
                  onClick={() => setDays(d)}
                >
                  {d}-day · {rates ? fmtMoney(total(d)) : '—'}
                </button>
              ))}
            </div>
          </div>

          {err && <div className="tiny danger-text" style={{ marginBottom: 8 }}>{err}</div>}

          <button className="btn btn-pri btn-sm" disabled={busy || uploading || !rates} onClick={buy}>
            {busy ? 'Opening payment…' : uploading ? 'Uploading…' : `Buy · ${rates ? fmtMoney(total(days)) : '—'} →`}
          </button>
        </>
      )}
    </div>
  );
}
