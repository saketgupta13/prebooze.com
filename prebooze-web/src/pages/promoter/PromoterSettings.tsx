import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { promoter as promoterApi, type PromoterMe } from '../../api';
import { ApiError } from '../../api/client';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import WysiwygEditor from '../../components/WysiwygEditor';
import Loader from '../../components/Loader';
import { RealUploadBox } from '../../components/RealUploadBox';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import { promoterPath } from '../../lib/urls';
import { CheckCircle2, ArrowRight, X, Upload } from 'lucide-react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Real promoter self-serve settings — GET/PATCH /promoter/me. Every field
 * captured at onboarding (PromoterOnboarding.tsx) round-trips here pre-filled
 * and editable — bio/links/audienceReach used to be onboarding-only with no
 * editor afterward (audienceReach wasn't even persisted at all). Bank details
 * follow the same masked-last4/edit-to-replace pattern as organizer's own
 * Settings.tsx — this is what an organizer who owes this promoter money for
 * a specific event actually pays out to (no split-payment rail exists,
 * they wire it manually). */
export default function PromoterSettings() {
  const { updateUser, toast } = useApp();
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brand, setBrand] = useState('');
  const [username, setUsername] = useState('');
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState('');
  const [audienceReach, setAudienceReach] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    promoterApi
      .me()
      .then((m) => {
        setMe(m);
        setLogoUrl(m.logoUrl ?? null);
        setBrand(m.name);
        setUsername(m.slug);
        setLoc({ country: m.country || 'India', state: m.state ?? '', city: m.city ?? '', pincode: m.pincode ?? '' });
        setBio(m.bio ?? '');
        setLinks((m.links ?? []).join(', '));
        setAudienceReach(m.audienceReach ?? '');
        setBankName(m.bankName ?? '');
        setAccountHolder(m.accountHolderName ?? '');
        setIfsc(m.ifsc ?? '');
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOpen = (key: string) => setOpen((o) => (o === key ? null : key));

  const saveProfile = async () => {
    setErr('');
    if (logoUploading) { setErr('Photo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      const updated = await promoterApi.updateMe({
        brandName: brand.trim(), username: username.trim(),
        city: loc.city.trim(), country: loc.country.trim(), state: loc.state.trim(), pincode: loc.pincode.trim(),
        bio,
        links: links.split(',').map((s) => s.trim()).filter(Boolean),
        audienceReach: audienceReach.trim(),
        logoUrl: logoUrl ?? undefined,
      });
      setMe(updated);
      // Header reads user.promoterLogoUrl (a copy kept in sync by
      // PromoterService.updateMe) — without this, a logo change here would
      // show correctly on this page but the header would keep showing the
      // old value until a full page reload remounted AppContext's /me fetch.
      updateUser({ promoterBrand: updated.name, promoterUsername: updated.slug, promoterLogoUrl: updated.logoUrl ?? undefined });
      toast('Profile saved ✓');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async () => {
    if (!bankName.trim() || !bankAccount.trim() || !accountHolder.trim() || !ifsc.trim()) return;
    setErr('');
    setSaving(true);
    try {
      const updated = await promoterApi.updateMe({ bankName, bankAccount, accountHolderName: accountHolder, ifsc });
      setMe(updated);
      setBankAccount('');
      setOpen(null);
      toast('Bank details saved ✓');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Profile &amp; settings</h1>
      <div style={{ maxWidth: 520, marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>

      <div className="card" style={{ maxWidth: 520, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3>Promoter profile</h3>
          {me.verified ? (
            <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Verified</span>
          ) : (
            <Link to="/promoter/settings/verification" className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Complete verification <ArrowRight size={14} /></Link>
          )}
        </div>
        {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
        <div className="tiny muted-2" style={{ marginBottom: 12 }}>Promoting since {fmtDate(me.createdAt)}</div>
        <RealUploadBox
          value={logoUrl}
          onChange={setLogoUrl}
          upload={promoterApi.upload}
          onBusyChange={setLogoUploading}
          label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={14} /> upload photo</span>}
          style={{ height: 100, width: 100, marginBottom: 14 }}
        />
        <div className="form-row">
          <div className="field">
            <span>Brand name</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
        </div>
        <LocationPicker value={loc} onChange={setLoc} />
        <div className="field">
          <span>Links (socials / WhatsApp)</span>
          <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / wa / telegram" />
        </div>
        <div className="field">
          <span>Bio — what nights do you run?</span>
          <WysiwygEditor value={bio} onChange={setBio} minHeight={80} />
        </div>
        <div className="field">
          <span>Audience size / reach</span>
          <input value={audienceReach} onChange={(e) => setAudienceReach(e.target.value)} placeholder="e.g. 8k on Instagram, 2k WhatsApp broadcast" />
        </div>
        <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }} disabled={saving || logoUploading} onClick={saveProfile}>
          {logoUploading ? 'Uploading…' : saving ? 'Saving…' : <><CheckCircle2 size={14} /> Save profile</>}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 520, marginBottom: 16 }}>
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Bank for payouts</div>
            <div className="tiny muted">
              {me.bankLast4 ? `${me.bankName ? me.bankName + ' · ' : ''}•••• ${me.bankLast4}` : 'no bank details on file'}
            </div>
            <div className="tiny muted-2" style={{ marginTop: 2 }}>
              organizers pay you directly for each event — this is where they send it
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('bank')}>
            {open === 'bank' ? 'Close' : 'Manage'}
          </button>
          {open === 'bank' && (
            <div style={{ flexBasis: '100%', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row">
                <div className="field">
                  <span>Bank name</span>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
                </div>
                <div className="field">
                  <span>Account holder's name</span>
                  <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Account number</span>
                  <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} inputMode="numeric" placeholder={me.bankLast4 ? `•••• ${me.bankLast4}` : undefined} />
                </div>
                <div className="field">
                  <span>IFSC code</span>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <button
                className="btn btn-pri btn-sm"
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                disabled={!bankName.trim() || !bankAccount.trim() || !accountHolder.trim() || !ifsc.trim() || saving}
                onClick={saveBank}
              >
                {saving ? 'Saving…' : <><CheckCircle2 size={14} /> Save bank details</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, borderColor: 'rgba(255,92,73,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="bold small danger-text">Stop promoting</div>
            <div className="tiny muted">deactivate your promoter account — your public profile is hidden</div>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Deactivate your promoter account? You can re-onboard anytime.'))
                updateUser({ isPromoter: false });
            }}
          >
            Deactivate
          </button>
        </div>
      </div>

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        Public profile: <Link to={promoterPath(me.city || 'Hyderabad', me.slug)} className="link">/promoter/{me.slug}</Link>
      </div>
    </div>
  );
}
