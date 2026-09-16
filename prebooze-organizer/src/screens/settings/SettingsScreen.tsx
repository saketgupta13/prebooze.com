import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { BadgeCheck, ChevronDown, ChevronRight, ChevronUp, ExternalLink, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { auth } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, Input, Muted, Screen, Txt } from '../../components/ui';
import ImageUploadBox from '../../components/ImageUploadBox';
import LocationPicker, { type LocationValue } from '../../components/LocationPicker';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { SITE_ORIGIN, organizerPath } from '../../lib/urls';
import type { MoreStackParamList } from '../../navigation/types';
import type { Organizer, PaymentProfile, SocialLinks } from '../../types';

const EVENT_TYPES = ['Concerts', 'Comedy', 'Festivals', 'Club nights', 'Corporate', 'Weddings & private', 'Mixed'];

type Draft = LocationValue & {
  brandName: string; username: string; contactPerson: string; contact: string; about: string;
  instagram: string; facebook: string; other: string[]; eventTypes: string[]; logoUrl: string | null;
};

const draftFrom = (o: Organizer): Draft => ({
  brandName: o.brandName, username: o.username, contactPerson: o.contactPerson ?? '', contact: o.contact ?? '',
  about: o.about ?? '', country: o.country ?? 'India', state: o.state ?? '', city: o.city ?? '', pincode: o.pincode ?? '',
  instagram: o.socialLinks?.instagram ?? '', facebook: o.socialLinks?.facebook ?? '',
  other: o.socialLinks?.other?.length ? o.socialLinks.other : [''],
  eventTypes: o.eventTypes ? o.eventTypes.split(',').map((s) => s.trim()).filter(Boolean) : [],
  logoUrl: o.logoUrl ?? null,
});

/** Faithful port of prebooze-web/src/pages/organizer/Settings.tsx — a hub
 * of collapsible sections (Brand profile, Verification, Payment profiles,
 * Team & roles) plus a phone-number-change flow. Deliberately dropped, per
 * web's own source comment: inline team management (lives only on the
 * Team & Roles screen), refund-policy defaults, self-deactivation — none of
 * these had a real backend behind them. The Notifications row below is new
 * for this app (2026-09-16, not a web port) — it deliberately shows the
 * real OS permission status rather than an in-app on/off toggle, since
 * there's no per-category preference to store yet (only one real trigger —
 * event approved/rejected — exists so far) and a toggle with nothing real
 * to gate would repeat the exact fake-toggle mistake web already backed
 * out of once. */
export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { user } = useAuth();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [notifPermission, setNotifPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [openBrand, setOpenBrand] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openPhone, setOpenPhone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .me()
        .then((me) => {
          if (cancelled) return;
          setOrg(me);
          setDraft(draftFrom(me));
          return organizer.paymentProfiles().catch(() => [] as PaymentProfile[]);
        })
        .then((p) => { if (!cancelled && p) setProfiles(p); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load settings'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  // Reflects reality if the organizer flips this in the OS settings and
  // comes back — refetched on every focus, not just mount.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Notifications.getPermissionsAsync().then((p) => { if (!cancelled) setNotifPermission(p.status); }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  const saveBrand = async () => {
    if (!draft) return;
    if (logoUploading) { setErr('Logo is still uploading — wait for it to finish before saving'); return; }
    setErr('');
    setSaving(true);
    try {
      const updated = await organizer.updateMe({
        brandName: draft.brandName.trim(), username: draft.username.trim().toLowerCase(),
        city: draft.city.trim(), country: draft.country.trim(), state: draft.state.trim(), pincode: draft.pincode.trim(),
        logoUrl: draft.logoUrl ?? undefined, about: draft.about.trim(),
        socialLinks: { instagram: draft.instagram.trim() || undefined, facebook: draft.facebook.trim() || undefined, other: draft.other.map((s) => s.trim()).filter(Boolean) },
        contact: draft.contact.trim(), contactPerson: draft.contactPerson.trim(), phone: org?.phone, eventTypes: draft.eventTypes.join(', '),
      });
      setOrg(updated);
      setDraft(draftFrom(updated));
      setOpenBrand(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const defaultProfile = profiles.find((p) => p.isDefault);

  if (loading || !org || !draft) {
    return (
      <Screen style={styles.center}>
        <Muted>Loading…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <H1 style={styles.title}>Settings</H1>
          <Pressable onPress={() => Linking.openURL(`${SITE_ORIGIN}${organizerPath(org.city, org.id)}`)} style={styles.viewProfileLink}>
            <Txt style={styles.link}>View public profile</Txt>
            <ExternalLink size={12} color={colors.accent} />
          </Pressable>
        </View>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <PhoneChangeCard open={openPhone} onToggle={() => setOpenPhone((s) => !s)} phone={user?.phone ?? ''} />

        <Card style={styles.hubCard}>
          <EvRow
            label="Brand profile"
            sub={`${org.brandName} · everything from your onboarding application, editable`}
            expanded={openBrand}
            onToggle={() => setOpenBrand((s) => !s)}
          />
          {openBrand && (
            <View style={styles.expandedBody}>
              <FieldLabel>Logo</FieldLabel>
              <ImageUploadBox value={draft.logoUrl} onChange={(url) => setDraft({ ...draft, logoUrl: url })} onBusyChange={setLogoUploading} width={80} height={80} label="upload logo" />

              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <FieldLabel>Organizer / brand name</FieldLabel>
                  <Input value={draft.brandName} onChangeText={(t) => setDraft({ ...draft, brandName: t })} style={styles.fieldGap} />
                </View>
                <View style={styles.flex1}>
                  <FieldLabel>Username</FieldLabel>
                  <Input value={draft.username} onChangeText={(t) => setDraft({ ...draft, username: t.toLowerCase() })} autoCapitalize="none" style={styles.fieldGap} />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <FieldLabel>Contact person</FieldLabel>
                  <Input value={draft.contactPerson} onChangeText={(t) => setDraft({ ...draft, contactPerson: t })} style={styles.fieldGap} />
                </View>
                <View style={styles.flex1}>
                  <FieldLabel>Business mobile number</FieldLabel>
                  <Input value={draft.contact} onChangeText={(t) => setDraft({ ...draft, contact: t })} placeholder="separate from your login number" keyboardType="phone-pad" style={styles.fieldGap} />
                </View>
              </View>

              <LocationPicker value={draft} onChange={(v) => setDraft({ ...draft, ...v })} />

              <FieldLabel>About the brand</FieldLabel>
              <Input value={draft.about} onChangeText={(t) => setDraft({ ...draft, about: t })} multiline numberOfLines={3} style={[styles.fieldGap, styles.textarea]} />

              <FieldLabel>Website & social links</FieldLabel>
              <Input value={draft.instagram} onChangeText={(t) => setDraft({ ...draft, instagram: t })} placeholder="instagram.com/yourbrand" autoCapitalize="none" style={styles.fieldGap} />
              <Input value={draft.facebook} onChangeText={(t) => setDraft({ ...draft, facebook: t })} placeholder="facebook.com/yourbrand" autoCapitalize="none" style={[styles.fieldGap, { marginTop: spacing.s }]} />
              {draft.other.map((link, i) => (
                <View key={i} style={styles.otherLinkRow}>
                  <Input
                    value={link}
                    onChangeText={(t) => { const next = [...draft.other]; next[i] = t; setDraft({ ...draft, other: next }); }}
                    placeholder="another link"
                    autoCapitalize="none"
                    style={styles.flex1}
                  />
                  <Pressable
                    onPress={() => {
                      const next = draft.other.filter((_, x) => x !== i);
                      setDraft({ ...draft, other: next.length ? next : [''] });
                    }}
                  >
                    <X size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => setDraft({ ...draft, other: [...draft.other, ''] })}>
                <Txt style={[styles.link, { marginTop: spacing.s }]}>+ Add another link</Txt>
              </Pressable>

              <FieldLabel>Event types you host</FieldLabel>
              <View style={styles.chipRow}>
                {EVENT_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={draft.eventTypes.includes(t) ? `${t} ✓` : t}
                    active={draft.eventTypes.includes(t)}
                    onPress={() => setDraft({ ...draft, eventTypes: draft.eventTypes.includes(t) ? draft.eventTypes.filter((x) => x !== t) : [...draft.eventTypes, t] })}
                  />
                ))}
              </View>

              <Button label={logoUploading ? 'Uploading logo…' : saving ? 'Saving…' : 'Save profile'} onPress={saveBrand} loading={saving} disabled={logoUploading || saving} style={{ marginTop: spacing.l }} />
            </View>
          )}
        </Card>

        <Card style={styles.hubCard}>
          <View style={styles.staticRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rowHead}>
                <Txt style={styles.bold}>Verification</Txt>
                {org.verified && <BadgeCheck size={14} color={colors.accent} />}
              </View>
              <Muted style={styles.tiny}>{org.verified ? 'Your identity is verified' : "Aadhaar/registration + selfie — a one-time verified badge, doesn't affect withdrawals"}</Muted>
            </View>
            {!org.verified && (
              <Pressable onPress={() => navigation.navigate('Verification')}><Txt style={styles.link}>Complete verification →</Txt></Pressable>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.staticRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={styles.bold}>Payment profiles</Txt>
              <Muted style={styles.tiny}>
                {profiles.length > 0 ? `${profiles.length} on file · default: ${defaultProfile?.bankAccountNumber ? '•••• ' + defaultProfile.bankAccountNumber.slice(-4) : 'none set'}` : 'No payment profile yet — required before withdrawing'}
              </Muted>
            </View>
            <Pressable onPress={() => navigation.navigate('PaymentProfiles')}><Txt style={styles.link}>Manage →</Txt></Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.staticRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={styles.bold}>Team & roles</Txt>
              <Muted style={styles.tiny}>door-scan access, managers</Muted>
            </View>
            <Pressable onPress={() => navigation.navigate('TeamRoles')}><Txt style={styles.link}>Manage →</Txt></Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.staticRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={styles.bold}>Notifications</Txt>
              <Muted style={styles.tiny}>
                {notifPermission === 'granted' ? 'Enabled — you\'ll get a push when something needs your attention' : 'Disabled — turn on to get pushes when something needs your attention'}
              </Muted>
            </View>
            {notifPermission !== 'granted' && (
              <Pressable onPress={() => Linking.openSettings()}><Txt style={styles.link}>Open settings →</Txt></Pressable>
            )}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function EvRow({ label, sub, expanded, onToggle }: { label: string; sub: string; expanded: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.staticRow} onPress={onToggle}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.bold}>{label}</Txt>
        <Muted style={styles.tiny} numberOfLines={1}>{sub}</Muted>
      </View>
      {expanded ? <ChevronUp size={16} color={colors.muted} /> : <ChevronRight size={16} color={colors.muted} />}
    </Pressable>
  );
}

function PhoneChangeCard({ open, onToggle, phone }: { open: boolean; onToggle: () => void; phone: string }) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [newPhone, setNewPhone] = useState('');
  const [requestId, setRequestId] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const requestChange = async () => {
    if (!newPhone.trim()) return;
    setErr('');
    setBusy(true);
    try {
      const res = await auth.requestPhoneChange(newPhone.trim());
      setRequestId(res.requestId);
      setDevCode(res.devCode);
      setStep('code');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const confirmChange = async () => {
    if (code.length !== 4) return;
    setErr('');
    setBusy(true);
    try {
      await auth.confirmPhoneChange(requestId, code);
      await refreshUser();
      setDone(true);
      setTimeout(() => { setDone(false); onToggle(); setStep('phone'); setNewPhone(''); setCode(''); }, 1500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.hubCard}>
      <Pressable style={styles.staticRow} onPress={onToggle}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={styles.bold}>Login number {phone} ✓</Txt>
        </View>
        {open ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
      </Pressable>
      {open && (
        <View style={styles.expandedBody}>
          {!!err && <Txt style={{ color: colors.danger, fontSize: fontSize.s, marginBottom: spacing.s }}>✕ {err}</Txt>}
          {done ? (
            <Muted>Login number updated ✓</Muted>
          ) : step === 'phone' ? (
            <>
              <FieldLabel>New mobile number</FieldLabel>
              <Input value={newPhone} onChangeText={setNewPhone} placeholder="+91" keyboardType="phone-pad" style={styles.fieldGap} />
              <Button label={busy ? 'Sending…' : 'Send code'} onPress={requestChange} loading={busy} disabled={!newPhone.trim()} style={{ marginTop: spacing.m }} />
            </>
          ) : (
            <>
              <FieldLabel>4-digit code</FieldLabel>
              <Input value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} style={styles.fieldGap} />
              {!!devCode && <Muted style={styles.tiny}>Dev code: {devCode}</Muted>}
              <Button label={busy ? 'Verifying…' : 'Confirm'} onPress={confirmChange} loading={busy} disabled={code.length !== 4} style={{ marginTop: spacing.m }} />
            </>
          )}
        </View>
      )}
    </Card>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Txt style={styles.fieldLabel}>{children}</Txt>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.l, marginTop: spacing.s },
  title: { fontSize: fontSize.display },
  viewProfileLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 12.5 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  hubCard: { padding: spacing.l, marginBottom: spacing.m },
  staticRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderDash, borderStyle: 'dashed', borderTopWidth: 1, borderTopColor: colors.borderDash, marginVertical: spacing.s },
  expandedBody: { marginTop: spacing.m, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  textarea: { height: 80, textAlignVertical: 'top', paddingTop: spacing.s },
  row2: { flexDirection: 'row', gap: spacing.s },
  flex1: { flex: 1 },
  otherLinkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
});
