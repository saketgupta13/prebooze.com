import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Copy, CheckCircle2, Eye, EyeOff, BadgeCheck } from 'lucide-react';
import {
  liveOrganizers, liveVenues, livePromoters, LiveApiError,
  type LiveOrganizer, type LiveVenue, type LivePromoter, type LivePaymentProfile, type LiveVenuePaymentProfile,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Payment details';

type PayeeType = 'organizer' | 'venue' | 'promoter';
const TYPES: { key: PayeeType; label: string }[] = [
  { key: 'organizer', label: 'Organizers' },
  { key: 'venue', label: 'Venues' },
  { key: 'promoter', label: 'Promoters' },
];

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ padding: '2px 6px', fontSize: 11 }}
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
    >
      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
    </button>
  );
}

/** Full account number, hidden by default (a shoulder-surf/screenshot guard,
 * not a real access control — the API already returned it in full to
 * anyone with view permission on this module) with one click to reveal,
 * plus a copy button so staff never has to retype it into a bank transfer
 * form. This is the field the whole page exists for: elsewhere in admin
 * (OrganizerEdit's PaymentProfilesCard) only ever shows •••• + last 4,
 * which is what actually blocked staff from paying anyone out directly. */
function AccountNumberField({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 0.5 }}>
        {shown ? value : '•'.repeat(Math.max(4, value.length - 4)) + value.slice(-4)}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setShown((s) => !s)} title={shown ? 'Hide' : 'Show'}>
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyChip value={value} />
    </div>
  );
}

function Row({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(139,195,74,.08)' }}>
      <span className="tiny muted">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textAlign: 'right' }}>
        {value || '—'}
        {copyable && value && <CopyChip value={value} />}
      </span>
    </div>
  );
}

/** Bank details for whoever Prebooze actually pays out — organizer, venue
 * (solo venue-hosted events), or promoter. Deep-linkable via
 * ?type=organizer|venue|promoter&id=... from Payments/RunPayoutBatch rows
 * and the three directory detail pages; also works as a standalone lookup
 * (pick a type, search by name) for "I need to wire someone their money,
 * where's their account number" without already having an id in hand. */
export default function PaymentDetails() {
  const session = useLiveSession();
  const { token } = session;
  const [params, setParams] = useSearchParams();

  const type = (params.get('type') as PayeeType) || 'organizer';
  const selectedId = params.get('id') ?? '';
  const [query, setQuery] = useState('');

  const [organizers, setOrganizers] = useState<LiveOrganizer[]>([]);
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [promoters, setPromoters] = useState<LivePromoter[]>([]);
  const [profiles, setProfiles] = useState<(LivePaymentProfile | LiveVenuePaymentProfile)[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoadingList(true);
    setErr('');
    const load = type === 'organizer' ? liveOrganizers.list().then(setOrganizers)
      : type === 'venue' ? liveVenues.list().then(setVenues)
      : livePromoters.list().then(setPromoters);
    load.catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoadingList(false));
  }, [token, type]);

  useEffect(() => {
    if (!token || !selectedId || type === 'promoter') { setProfiles([]); return; }
    setLoadingProfiles(true);
    setErr('');
    const load = type === 'organizer' ? liveOrganizers.paymentProfiles(selectedId) : liveVenues.paymentProfiles(selectedId);
    load.then(setProfiles).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load payment profiles')).finally(() => setLoadingProfiles(false));
  }, [token, type, selectedId]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const list = type === 'organizer' ? organizers : type === 'venue' ? venues : promoters;
  const name = (x: LiveOrganizer | LiveVenue | LivePromoter) => ('brandName' in x ? x.brandName : x.name);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((x) => name(x).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, query]);

  const selected = list.find((x) => x.id === selectedId);
  const selectedPromoter = type === 'promoter' ? (selected as LivePromoter | undefined) : undefined;

  const setType = (t: PayeeType) => { setParams({ type: t }); setQuery(''); };
  const select = (id: string) => setParams({ type, id });

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd">
        <h1 className="page-title">Payment details</h1>
      </div>
      <div className="tiny muted">Look up the real bank account for whoever Prebooze owes money — organizer, venue, or promoter — so you can actually send it.</div>

      <div className="tabs">
        {TYPES.map((t) => (
          <button key={t.key} className={type === t.key ? 'on' : ''} onClick={() => setType(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="two-col" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid rgba(139,195,74,.15)' }}>
            <div className="search-box" style={{ padding: '4px 8px' }}>
              <span style={{ opacity: 0.6, display: 'flex' }}><Search size={14} /></span>
              <input placeholder={`Search ${TYPES.find((t) => t.key === type)?.label.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loadingList && <div className="tiny muted" style={{ padding: 10 }}>Loading…</div>}
            {!loadingList && filtered.length === 0 && <div className="tiny muted" style={{ padding: 10 }}>No match.</div>}
            {filtered.map((x) => (
              <button
                key={x.id}
                onClick={() => select(x.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13,
                  background: x.id === selectedId ? 'rgba(139,195,74,.1)' : 'none', border: 'none', borderBottom: '1px solid rgba(139,195,74,.06)', cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: x.id === selectedId ? 700 : 400 }}>{name(x)}</span>
                <span className="tiny muted" style={{ display: 'block' }}>{x.city || '—'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          {!selected && <div className="card"><div className="tiny muted">Pick a {type} from the list to see their payment details.</div></div>}

          {selected && type !== 'promoter' && (
            <>
              {loadingProfiles && <div className="tiny muted">Loading payment profiles…</div>}
              {!loadingProfiles && profiles.length === 0 && (
                <div className="card"><div className="tiny muted">No payment profile on file — {name(selected)} hasn't added one yet.</div></div>
              )}
              {profiles.map((p) => (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span className="display" style={{ fontWeight: 700 }}>{p.legalName}</span>
                    {p.isDefault && <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><BadgeCheck size={11} /> Default</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(139,195,74,.08)' }}>
                    <span className="tiny muted">Account number</span>
                    <AccountNumberField value={p.bankAccountNumber} />
                  </div>
                  <Row label="Account holder" value={p.accountHolderName} />
                  <Row label="IFSC" value={p.ifsc} copyable />
                  <Row label="Branch" value={p.branch ?? ''} />
                  <Row label="PAN" value={p.pan} copyable />
                  <Row label="GSTIN" value={p.noGst ? 'Not registered' : (p.gstin ?? '')} />
                  <Row label="Business address" value={[p.businessAddress, p.city, p.state, p.pincode].filter(Boolean).join(', ')} />
                </div>
              ))}
            </>
          )}

          {selectedPromoter && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!selectedPromoter.bankAccountNumber ? (
                <div className="tiny muted">No bank details on file — {selectedPromoter.name} hasn't added them yet.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(139,195,74,.08)' }}>
                    <span className="tiny muted">Account number</span>
                    <AccountNumberField value={selectedPromoter.bankAccountNumber} />
                  </div>
                  <Row label="Account holder" value={selectedPromoter.accountHolderName ?? ''} />
                  <Row label="Bank" value={selectedPromoter.bankName ?? ''} />
                  <Row label="IFSC" value={selectedPromoter.ifsc ?? ''} copyable />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
