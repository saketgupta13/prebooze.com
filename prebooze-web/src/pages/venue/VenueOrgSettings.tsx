import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import { RealUploadBox } from '../../components/RealUploadBox';
import Loader from '../../components/Loader';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import type { Venue } from '../../types';
import { venuePath } from '../../lib/urls';

/** Organizer panel's own Settings — a real, separate editing surface from
 * the Venue panel's "My listing"/Settings, same structure as
 * organizer/Settings.tsx (Brand profile / Verification / Payouts / Team &
 * roles), not a stub pointing back to the venue panel. Both panels write
 * the same underlying Venue row through GET/PATCH /venue/listing — same
 * "two doors into one record" precedent as any two views of shared data
 * elsewhere in this console, not a duplicate data model. */
export default function VenueOrgSettings() {
  const { updateUser } = useApp();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [name, setName] = useState('');
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [about, setAbout] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [profileCount, setProfileCount] = useState<number | null>(null);

  useEffect(() => {
    venuePartner
      .myListing()
      .then((v) => {
        setVenue(v);
        setLogoUrl(v.logoUrl ?? null);
        setName(v.name ?? '');
        setLoc({ country: v.country || 'India', state: v.state ?? '', city: v.city ?? '', pincode: v.pincode ?? '' });
        setAbout(v.about ?? '');
        setInstagram(v.socialLinks?.instagram ?? '');
        setFacebook(v.socialLinks?.facebook ?? '');
        setContactPerson(v.contactPerson ?? '');
        setContactPersonPhone(v.contactPersonPhone ?? '');
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    venuePartner.paymentProfiles().then((p) => setProfileCount(p.length)).catch(() => setProfileCount(0));
  }, []);

  const saveProfile = async () => {
    setErr('');
    if (logoUploading) { setErr('Logo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      const updated = await venuePartner.updateListing({
        name: name.trim(),
        city: loc.city.trim(), country: loc.country.trim(), state: loc.state.trim(), pincode: loc.pincode.trim(),
        logoUrl: logoUrl ?? undefined,
        about,
        socialLinks: { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined },
        contactPerson: contactPerson.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
      });
      setVenue(updated);
      setOpen(false);
      // Header reads user.venueName/venueLogoUrl — same sync organizer's own
      // Settings.tsx does for orgBrand/orgLogoUrl, same reasoning.
      updateUser({ venueName: updated.name, venueLogoUrl: updated.logoUrl ?? undefined });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!venue) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
        <Link to={venuePath(venue.city, venue.id)} className="link small bold">View public page ↗</Link>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <div style={{ marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>

      <div className="card">
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Brand profile</div>
            <div className="tiny muted">{venue.name} · shown to guests and organizers picking a venue</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Manage'}
          </button>
          {open && (
            <div style={{ flexBasis: '100%', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="field">
                <span>Logo</span>
                <RealUploadBox value={logoUrl} onChange={setLogoUrl} upload={venuePartner.upload} onBusyChange={setLogoUploading} label="⬆ upload logo" style={{ height: 100, width: 100 }} />
              </div>
              <div className="field">
                <span>Venue name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Contact person</span>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </div>
                <div className="field">
                  <span>Contact person phone</span>
                  <input value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} inputMode="tel" />
                </div>
              </div>
              <LocationPicker value={loc} onChange={setLoc} />
              <div className="field">
                <span>About the venue</span>
                <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} />
              </div>
              <div className="field">
                <span>Social media</span>
                <div className="form-row">
                  <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourvenue" />
                  <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourvenue" />
                </div>
              </div>
              <div className="tiny muted-2">venue type, amenities, timings and photos live on the venue panel's My listing page — same record, one place for display details</div>
              <button className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }} disabled={saving || logoUploading} onClick={saveProfile}>
                {logoUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save profile ✓'}
              </button>
            </div>
          )}
        </div>

        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">
              Verification
              {venue.verified && <span className="verified" style={{ marginLeft: 6 }}>✓</span>}
            </div>
            <div className="tiny muted">
              {venue.verified ? 'Your identity is verified' : "License + address proof — a one-time verified badge, doesn't affect hosting"}
            </div>
          </div>
          {!venue.verified && <Link to="/venue/settings/verification" className="btn btn-pri btn-sm">Complete verification →</Link>}
        </div>

        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Payment profiles</div>
            <div className="tiny muted">
              {profileCount === null ? 'Loading…' : profileCount > 0 ? `${profileCount} on file` : 'No payment profile yet — required before withdrawing'}
            </div>
          </div>
          <Link to="/venue/hosting/settings/payment-profiles" className="btn btn-ghost btn-sm">Manage →</Link>
        </div>

        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Team & roles</div>
            <div className="tiny muted">door-scan access, managers</div>
          </div>
          <Link to="/venue/hosting/team" className="btn btn-ghost btn-sm">Manage →</Link>
        </div>
      </div>
    </div>
  );
}
