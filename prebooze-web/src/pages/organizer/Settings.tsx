import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import { RealUploadBox } from '../../components/RealUploadBox';
import Loader from '../../components/Loader';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import type { Organizer, PaymentProfile } from '../../types';
import { organizerPath } from '../../lib/urls';
import { ExternalLink, X, Upload, Check, BadgeCheck, ArrowRight } from 'lucide-react';

const EVENT_TYPES = ['Concerts', 'Comedy', 'Festivals', 'Club nights', 'Corporate', 'Weddings & private', 'Mixed'];

/** Real organizer self-serve settings — GET/PATCH /organizer/me. Every field
 * captured at onboarding (Onboarding.tsx) round-trips here pre-filled and
 * editable, since GET /organizer/me returns the same row
 * KycService.newOrganizerRow wrote at approval time — including brand name,
 * username and city, which used to be "changes go through support" (see git
 * history); an organizer now corrects/rebrands those themselves, same as
 * everything else here. Team members, notification prefs, refund-policy
 * defaults and self-deactivation had no real backend behind them at all (no
 * Prisma fields, no endpoints) — dropped rather than left as toggles that
 * silently do nothing. Team & roles stays reachable via its own nav item. */
export default function Settings() {
  const { updateUser } = useApp();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');
  const [username, setUsername] = useState('');
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [about, setAbout] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [other, setOther] = useState<string[]>(['']);
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);

  useEffect(() => {
    Promise.all([organizer.me(), organizer.paymentProfiles()])
      .then(([o, p]) => {
        setOrg(o);
        setProfiles(p);
        setLogoUrl(o.logoUrl ?? null);
        setBrandName(o.brandName ?? '');
        setUsername(o.username ?? '');
        setLoc({ country: o.country || 'India', state: o.state ?? '', city: o.city ?? '', pincode: o.pincode ?? '' });
        setAbout(o.about ?? '');
        setInstagram(o.socialLinks?.instagram ?? '');
        setFacebook(o.socialLinks?.facebook ?? '');
        const o2 = o.socialLinks?.other ?? [];
        setOther(o2.length ? o2 : ['']);
        setContactPerson(o.contactPerson ?? '');
        setContact(o.contact ?? '');
        setOrgPhone(o.phone ?? '');
        setEventTypes(o.eventTypes ? o.eventTypes.split(',').map((t) => t.trim()).filter(Boolean) : []);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const toggleOpen = (key: string) => setOpen((o) => (o === key ? null : key));
  const toggleType = (t: string) => setEventTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const setOtherLink = (i: number, v: string) => setOther((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addOtherLink = () => setOther((prev) => [...prev, '']);
  const removeOtherLink = (i: number) => setOther((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  const saveProfile = async () => {
    setErr('');
    // Real 2026-08-29 bug: a logo upload still in flight — saving here
    // would either lose the upload once it lands after this page has
    // already moved on, or persist blank when the file never actually
    // finished. See RealUploadBox's onBusyChange doc comment.
    if (logoUploading) { setErr('Logo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      const updated = await organizer.updateMe({
        brandName: brandName.trim(), username: username.trim(),
        city: loc.city.trim(), country: loc.country.trim(), state: loc.state.trim(), pincode: loc.pincode.trim(),
        logoUrl: logoUrl ?? undefined,
        about,
        socialLinks: { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined, other: other.map((l) => l.trim()).filter(Boolean) },
        contactPerson, contact, phone: orgPhone, eventTypes: eventTypes.join(', '),
      });
      setOrg(updated);
      setOpen(null);
      // Header reads user.orgBrand/orgLogoUrl (a copy set once at KYC time) —
      // without this, a rename/logo change here would show correctly on
      // this page but the header would keep showing the old value until a
      // full page reload remounted AppContext's one-time /me fetch.
      updateUser({ orgBrand: updated.brandName, orgLogoUrl: updated.logoUrl ?? undefined });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!org) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
        <Link to={organizerPath(org.city, org.id)} className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>View public profile <ExternalLink size={13} /></Link>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <div style={{ marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>
      <div className="card">
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Brand profile</div>
            <div className="tiny muted">{org.brandName} · everything from your onboarding application, editable</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('profile')}>
            {open === 'profile' ? 'Close' : 'Manage'}
          </button>
          {open === 'profile' && (
            <div style={{ flexBasis: '100%', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="field">
                <span>Logo</span>
                <RealUploadBox value={logoUrl} onChange={setLogoUrl} upload={organizer.upload} onBusyChange={setLogoUploading} label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> upload logo</span>} style={{ height: 100, width: 100 }} />
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Organizer / brand name</span>
                  <input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </div>
                <div className="field">
                  <span>Username</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Contact person</span>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </div>
                <div className="field">
                  <span>Business mobile number</span>
                  <input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="separate from your login number" />
                </div>
              </div>
              <div className="field">
                <span>Business email</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <LocationPicker value={loc} onChange={setLoc} />
              <div className="field">
                <span>About the brand</span>
                <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} />
              </div>
              <div className="field">
                <span>Website & social links</span>
                <div className="form-row">
                  <div className="field">
                    <span>Instagram</span>
                    <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourbrand" />
                  </div>
                  <div className="field">
                    <span>Facebook</span>
                    <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourbrand" />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {other.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <input
                        style={{ flex: 1 }}
                        value={l}
                        onChange={(e) => setOtherLink(i, e.target.value)}
                        placeholder={i === 0 ? 'Website, X, YouTube…' : 'Another link'}
                      />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOtherLink(i)} title="Remove"><X size={13} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addOtherLink}>+ Add another link</button>
                </div>
              </div>
              <div className="field">
                <span>Event types you host</span>
                <div className="chip-row">
                  {EVENT_TYPES.map((t) => (
                    <button type="button" key={t} className={`chip ${eventTypes.includes(t) ? 'on' : ''}`} onClick={() => toggleType(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {t}{eventTypes.includes(t) ? <Check size={12} /> : ''}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={saving || logoUploading} onClick={saveProfile}>
                {logoUploading ? 'Uploading logo…' : saving ? 'Saving…' : <>Save profile <Check size={13} /></>}
              </button>
            </div>
          )}
        </div>

        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">
              Verification
              {org.verified && <span className="verified" style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}><BadgeCheck size={14} /></span>}
            </div>
            <div className="tiny muted">
              {org.verified ? 'Your identity is verified' : 'Aadhaar/registration + selfie — a one-time verified badge, doesn\'t affect withdrawals'}
            </div>
          </div>
          {!org.verified && <Link to="/organizer/settings/verification" className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>Complete verification <ArrowRight size={13} /></Link>}
        </div>

        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Payment profiles</div>
            <div className="tiny muted">
              {profiles.length
                ? `${profiles.length} on file · default: ${profiles.find((p) => p.isDefault)?.bankLast4 ? `•••• ${profiles.find((p) => p.isDefault)!.bankLast4}` : 'none set'}`
                : 'No payment profile yet — required before withdrawing'}
            </div>
          </div>
          <Link to="/organizer/settings/payment-profiles" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>Manage <ArrowRight size={13} /></Link>
        </div>

        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Team & roles</div>
            <div className="tiny muted">door-scan access, managers</div>
          </div>
          <Link to="/organizer/team" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>Manage <ArrowRight size={13} /></Link>
        </div>
      </div>
    </div>
  );
}
