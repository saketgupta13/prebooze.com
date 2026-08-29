import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LiveLocationPicker, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import RealImageUpload from '../components/RealImageUpload';
import AdminChangePhone from '../components/AdminChangePhone';
import { liveOrganizers, liveCustomers, LiveApiError, type LiveOrganizer, type LivePaymentProfile } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit organizer';

export function SocialLinksEditor({ value, onChange }: { value: { instagram?: string; facebook?: string; other?: string[] } | null; onChange: (v: { instagram?: string; facebook?: string; other?: string[] }) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input className="input" value={value?.instagram ?? ''} onChange={(e) => onChange({ ...value, instagram: e.target.value })} placeholder="instagram.com/…" />
      <input className="input" value={value?.facebook ?? ''} onChange={(e) => onChange({ ...value, facebook: e.target.value })} placeholder="facebook.com/…" />
    </div>
  );
}

/** Edit organizer — real Organizer row (business profile). No document
 * re-upload here (that only happens during verification, see
 * VerificationDetail.tsx) — this is for correcting or completing an
 * organizer's own business details after the fact. Bank/PAN/GSTIN live on
 * PaymentProfile now (plural, self-serve) — see the card below, not this
 * form's own state. */
export default function OrganizerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [org, setOrg] = useState<LiveOrganizer | null>(null);
  const [profiles, setProfiles] = useState<LivePaymentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    brandName: '', contactPerson: '', contact: '', phone: '', eventTypes: '', about: '', pincode: '',
  });
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; other?: string[] } | null>(null);
  const [loc, setLoc] = useState({ country: 'India', state: '', city: '' });
  const [seo, setSeo] = useState<Seo>(emptySeo());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [loginPhone, setLoginPhone] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveOrganizers
      .list()
      .then((orgs) => {
        const o = orgs.find((x) => x.id === id);
        setOrg(o ?? null);
        if (o) {
          setForm({
            brandName: o.brandName, contactPerson: o.contactPerson ?? '', contact: o.contact ?? '', phone: o.phone ?? '',
            eventTypes: o.eventTypes ?? '', about: o.about ?? '', pincode: o.pincode ?? '',
          });
          setSocialLinks(o.socialLinks ?? null);
          setLoc({ country: o.country ?? 'India', state: o.state ?? '', city: o.city });
          setSeo((o.seo as Seo | null) ?? emptySeo());
          setLogoUrl(o.logoUrl ?? null);
          liveOrganizers.paymentProfiles(o.id).then(setProfiles).catch(() => {});
          if (o.userId) liveCustomers.get(o.userId).then((c) => setLoginPhone(c.phone)).catch(() => {});
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !org) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Organizer not found</h1>
        <Link to="/organizers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Organizers</Link>
      </div>
    );
  }
  if (!org) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName.trim()) { setErr('Organizer name is required'); return; }
    if (!loc.city.trim()) { setErr('Pick a city'); return; }
    // Real 2026-08-29 bug: a logo upload still in flight (or one that had
    // already failed and silently left the field blank) — saving here
    // would either lose the upload once it lands after this page has
    // already navigated away, or persist blank when the file never
    // actually finished. See RealImageUpload's onBusyChange doc comment.
    if (logoUploading) { setErr('Logo is still uploading — wait for it to finish before saving'); return; }
    try {
      await liveOrganizers.update(org.id, {
        ...form,
        brandName: form.brandName.trim(),
        city: loc.city, state: loc.state || undefined, country: loc.country || undefined,
        socialLinks: socialLinks ?? undefined,
        seo,
        logoUrl,
      });
      navigate(`/organizers/${org.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/organizers/${org.id}`} style={{ fontSize: 13 }}>← {org.brandName}</Link>
        <h1 className="page-title">Edit organizer</h1>
        {org.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Unverified" cls="" />}
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Business profile</div>
        <div className="field">
          <label>Logo</label>
          <RealImageUpload value={logoUrl} onChange={setLogoUrl} onBusyChange={setLogoUploading} height={90} width={90} label="⬆ upload logo" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Organizer / brand name</label>
            <input className="input" value={form.brandName} onChange={set('brandName')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact person</label>
            <input className="input" value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Email</label>
            <input className="input" value={form.contact} onChange={set('contact')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Phone / WhatsApp</label>
            <input className="input" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <LiveLocationPicker value={loc} onChange={setLoc} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Pincode</label>
            <input className="input" value={form.pincode} onChange={set('pincode')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Event types hosted</label>
            <input className="input" value={form.eventTypes} onChange={set('eventTypes')} placeholder="Concerts, Festivals…" />
          </div>
        </div>
        <div className="field">
          <label>About the brand</label>
          <WysiwygEditor value={form.about} onChange={(html) => setForm((f) => ({ ...f, about: html }))} minHeight={60} />
        </div>
        <div className="field">
          <label>Social links</label>
          <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
        </div>
      </div>

      {org.userId && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="display" style={{ fontWeight: 700 }}>Account access</div>
          <AdminChangePhone userId={org.userId} currentPhone={loginPhone} />
        </div>
      )}

      <PaymentProfilesCard organizerId={org.id} profiles={profiles} onChange={setProfiles} />

      <SeoFields
        seo={seo}
        onChange={setSeo}
        slug={'/organizers/' + form.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        fallbackTitle={`${form.brandName || 'Organizer'} — events & tickets`}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }} disabled={logoUploading}>{logoUploading ? 'Uploading logo…' : 'Save organizer'}</button>
        <Link to={`/organizers/${org.id}`} className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}

/** Bank accounts the organizer manages themselves (self-serve, no admin
 * review — see PaymentProfile). This card is support-ticket convenience
 * only: staff can view/correct an entry on the organizer's behalf, same
 * "god mode" edit access admin already has over everything else — it does
 * NOT gate identity verification (org.verified above is unrelated). */
function PaymentProfilesCard({ organizerId, profiles, onChange }: {
  organizerId: string; profiles: LivePaymentProfile[]; onChange: (p: LivePaymentProfile[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ legalName: '', bankAccountNumber: '', accountHolderName: '', ifsc: '', pan: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const startEdit = (p: LivePaymentProfile) => {
    setForm({ legalName: p.legalName, bankAccountNumber: '', accountHolderName: p.accountHolderName, ifsc: p.ifsc, pan: p.pan, gstin: p.gstin ?? '' });
    setEditingId(p.id);
    setErr('');
  };

  const save = async (id: string) => {
    setSaving(true);
    setErr('');
    try {
      const patch: Partial<LivePaymentProfile> = {
        legalName: form.legalName || undefined,
        accountHolderName: form.accountHolderName || undefined,
        ifsc: form.ifsc ? form.ifsc.toUpperCase() : undefined,
        pan: form.pan ? form.pan.toUpperCase() : undefined,
        gstin: form.gstin ? form.gstin.toUpperCase() : undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
      };
      const updated = await liveOrganizers.updatePaymentProfile(organizerId, id, patch);
      onChange(profiles.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="display" style={{ fontWeight: 700 }}>Payment profiles</div>
      {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
      {!profiles.length && <div className="tiny muted">No payment profile on file — the organizer hasn't added one yet.</div>}
      {profiles.map((p) => (
        <div key={p.id} style={{ borderBottom: '1px solid rgba(139,195,74,.08)', paddingBottom: 10 }}>
          {editingId === p.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Legal name</label>
                  <input className="input" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Account holder</label>
                  <input className="input" value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Account number</label>
                  <input className="input" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} inputMode="numeric" placeholder={`•••• ${p.bankLast4}`} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>IFSC</label>
                  <input className="input" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>PAN</label>
                  <input className="input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>GSTIN</label>
                  <input className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} disabled={p.noGst} />
                </div>
              </div>
              <div className="tiny hint">leave account number blank to keep its current saved value</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-pri btn-sm" disabled={saving} onClick={() => save(p.id)}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div className="tiny" style={{ fontWeight: 700 }}>
                  {p.legalName}{p.isDefault && <span className="tiny muted" style={{ marginLeft: 6 }}>· default</span>}
                </div>
                <div className="tiny muted">•••• {p.bankLast4} · {p.accountHolderName} · {p.ifsc} · PAN {p.pan}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
