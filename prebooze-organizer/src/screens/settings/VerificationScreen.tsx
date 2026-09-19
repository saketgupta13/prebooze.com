import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AlertTriangle, ArrowLeft, BadgeCheck, Check, FileText, RotateCcw, Shield, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { kyc } from '../../api/kyc';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { KycSubmission, Organizer } from '../../types';

const ROLE_OPTIONS = ['Owner', 'Manager', 'Accountant', 'Other'];

// Copy tailored per document type for the rejected/resubmit state — "please
// re-upload" reads oddly for a selfie, which is really "please retake."
const DOC_TYPE_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar card',
  registration: 'Business registration',
  ownerAadhaar: "Owner's Aadhaar card",
  selfie: 'Selfie',
};
const rejectedActionLabel = (type: string) => (type === 'selfie' ? 'Retake selfie' : 'Re-upload');

type Doc = { uri: string; name: string; mimeType: string } | null;

/** Faithful port of prebooze-web/src/pages/organizer/OrganizerVerification.tsx
 * — identity-only badge (doesn't affect withdrawals, see PaymentProfiles for
 * that). Aadhaar/registration docs use expo-document-picker (image or PDF,
 * matching web's `accept="image/*,.pdf"`); the selfie stays image-only via
 * expo-image-picker, matching web's camera-oriented "capture or upload a
 * selfie" copy.
 *
 * Rejected-resubmission flow (2026-09-19 — a real bug found live: an
 * organizer whose submission staff had just rejected saw nothing at all,
 * just a blank form again with no reason and every field/document wiped,
 * on both this app and web). The org's own words: don't erase what they
 * already gave us, just point at what's actually wrong. So on the latest
 * submission being 'rejected': show the reviewer's reason up top, pre-fill
 * every non-document field from that submission's payload, and per
 * document only make the ones staff actually flagged
 * (KycSubmission.rejectedDocTypes) show as needing a fresh file — anything
 * NOT flagged is carried forward server-side by referencing the already-
 * stored file (see KycService.submitOrganizerVerification's
 * previousSubmissionId handling), so the organizer only has to touch what
 * was actually wrong. */
export default function VerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [latestSub, setLatestSub] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const [entityType, setEntityType] = useState<'individual' | 'firm' | ''>('');
  const [aadhaar, setAadhaar] = useState<Doc>(null);
  const [registration, setRegistration] = useState<Doc>(null);
  const [ownerAadhaar, setOwnerAadhaar] = useState<Doc>(null);
  const [selfie, setSelfie] = useState<Doc>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactRoleOther, setContactRoleOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([organizer.me(), kyc.myStatus()])
        .then(([me, subs]) => {
          if (cancelled) return;
          setOrg(me);
          setLatestSub(subs.find((s) => s.kind === 'organizer') ?? null);
        })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const rejectedSub = latestSub?.status === 'rejected' ? latestSub : null;
  const pending = latestSub?.status === 'pending';

  // Pre-fill once per rejected submission (not every render) — an
  // organizer editing a field shouldn't have it stomped back to the old
  // value on an unrelated re-render.
  if (rejectedSub && prefilledFor !== rejectedSub.id) {
    const p = rejectedSub.payload;
    if (p.entityType) setEntityType(p.entityType);
    setContactName(p.contactName ?? '');
    setContactPhone(p.contactPhone ?? '');
    setContactEmail(p.contactEmail ?? '');
    setContactRole(p.contactRole ?? '');
    setContactRoleOther(p.contactRoleOther ?? '');
    setPrefilledFor(rejectedSub.id);
  }

  const rejectedTypes = new Set(rejectedSub?.rejectedDocTypes ?? []);
  const providedTypes = new Set((rejectedSub?.documents ?? []).map((d) => d.type));
  // A required doc is satisfied either by a freshly picked local file, or —
  // only when resubmitting — by being on file already and not one of the
  // ones staff flagged.
  const satisfied = (type: string, local: Doc) => !!local || (!!rejectedSub && providedTypes.has(type) && !rejectedTypes.has(type));

  const pick = async (setter: (d: Doc) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setter({ uri: a.uri, name: a.fileName ?? `upload-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  // Aadhaar/registration docs — image or PDF, matching web's
  // accept="image/*,.pdf" (a firm's registration certificate is often
  // issued as a PDF).
  const pickDoc = async (setter: (d: Doc) => void) => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setter({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' });
  };

  const docsValid = entityType === 'individual'
    ? satisfied('aadhaar', aadhaar)
    : entityType === 'firm'
    ? satisfied('registration', registration) && satisfied('ownerAadhaar', ownerAadhaar)
    : false;
  const contactValid = !!(contactName.trim() && contactPhone.trim() && contactEmail.trim() && contactRole && (contactRole !== 'Other' || contactRoleOther.trim()));
  const valid = !!entityType && docsValid && satisfied('selfie', selfie) && contactValid;

  const submit = async () => {
    if (!valid || !entityType) return;
    setErr('');
    setSubmitting(true);
    try {
      const slots: { type: string; doc: Doc }[] = entityType === 'individual'
        ? [{ type: 'aadhaar', doc: aadhaar }, { type: 'selfie', doc: selfie }]
        : [{ type: 'registration', doc: registration }, { type: 'ownerAadhaar', doc: ownerAadhaar }, { type: 'selfie', doc: selfie }];
      // Only freshly-picked files are actually uploaded — anything left
      // blank here that isn't flagged gets carried forward server-side via
      // previousSubmissionId, so an organizer touching just the one bad
      // document doesn't have to re-pick everything else.
      const fresh = slots.filter((s): s is { type: string; doc: NonNullable<Doc> } => !!s.doc);
      const docLabels = fresh.map((s) => s.type);
      const docs = fresh.map((s) => s.doc);
      await kyc.submitOrganizerVerification(
        {
          entityType, contactName: contactName.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim(),
          contactRole, contactRoleOther: contactRole === 'Other' ? contactRoleOther.trim() : undefined,
          docLabels, previousSubmissionId: rejectedSub?.id,
        },
        docs,
      );
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton onPress={() => navigation.goBack()}><ArrowLeft size={18} color={colors.text} /></IconButton>
          <H1 style={styles.title}>Verification</H1>
        </View>
        <Muted style={styles.centerNote}>Loading…</Muted>
      </Screen>
    );
  }

  if (org?.verified) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton onPress={() => navigation.goBack()}><ArrowLeft size={18} color={colors.text} /></IconButton>
          <H1 style={styles.title}>Verification</H1>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.statusCard}>
            <BadgeCheck size={32} color={colors.accent} />
            <Txt style={[styles.bold, styles.statusTitle]}>You're verified ✓</Txt>
            <Muted style={styles.centerNote}>Your identity has been verified.</Muted>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  if (pending || done) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton onPress={() => navigation.goBack()}><ArrowLeft size={18} color={colors.text} /></IconButton>
          <H1 style={styles.title}>Verification</H1>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.statusCard}>
            <Shield size={32} color={colors.muted} />
            <Txt style={[styles.bold, styles.statusTitle]}>Verification under review</Txt>
            <Muted style={styles.centerNote}>We've got your details — our team usually reviews within 24h. You'll get a WhatsApp/email once you're verified.</Muted>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}><ArrowLeft size={18} color={colors.text} /></IconButton>
        <H1 style={styles.title}>Verification</H1>
      </View>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {rejectedSub && (
          <Card style={styles.rejectCard}>
            <View style={styles.rejectHead}>
              <AlertTriangle size={18} color={colors.danger} />
              <Txt style={[styles.bold, { color: colors.danger }]}>Verification rejected</Txt>
            </View>
            {!!rejectedSub.reviewNote && <Txt style={styles.rejectReason}>{rejectedSub.reviewNote}</Txt>}
            {rejectedTypes.size > 0 && (
              <Muted style={styles.tiny}>
                Please fix: {[...rejectedTypes].map((t) => DOC_TYPE_LABEL[t] ?? t).join(', ')}. Everything else you sent is kept — no need to redo it.
              </Muted>
            )}
          </Card>
        )}

        <Muted style={styles.subhead}>Identity verification only — gets you the ✓ verified badge. Doesn't affect withdrawals; add a payment profile for that in Settings.</Muted>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Card style={styles.card}>
          <Txt style={styles.bold}>Who are we verifying?</Txt>
          <View style={[styles.chipRow, { marginTop: spacing.s }]}>
            <Chip label="Individual" active={entityType === 'individual'} onPress={() => setEntityType('individual')} />
            <Chip label="Firm / Company / LLP" active={entityType === 'firm'} onPress={() => setEntityType('firm')} />
          </View>
        </Card>

        {!!entityType && (
          <Card style={styles.card}>
            <Txt style={styles.bold}>Documents</Txt>
            <Muted style={styles.tiny}>We don't have a way to validate these automatically — a real person on our team reviews them.</Muted>
            <View style={styles.docsRow}>
              {entityType === 'individual' ? (
                <DocBox type="aadhaar" label="Aadhaar card" doc={aadhaar} onPick={() => pickDoc(setAadhaar)} flagged={rejectedTypes.has('aadhaar')} kept={satisfied('aadhaar', aadhaar) && !aadhaar} />
              ) : (
                <>
                  <DocBox type="registration" label="Business registration" doc={registration} onPick={() => pickDoc(setRegistration)} flagged={rejectedTypes.has('registration')} kept={satisfied('registration', registration) && !registration} />
                  <DocBox type="ownerAadhaar" label="Owner's Aadhaar card" doc={ownerAadhaar} onPick={() => pickDoc(setOwnerAadhaar)} flagged={rejectedTypes.has('ownerAadhaar')} kept={satisfied('ownerAadhaar', ownerAadhaar) && !ownerAadhaar} />
                </>
              )}
              <DocBox type="selfie" label="Selfie" doc={selfie} onPick={() => pick(setSelfie)} flagged={rejectedTypes.has('selfie')} kept={satisfied('selfie', selfie) && !selfie} />
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Txt style={styles.bold}>Who's submitting this?</Txt>
          <Muted style={styles.tiny}>Not always the owner — tell us who we're talking to and their role.</Muted>
          <FieldLabel>Name *</FieldLabel>
          <Input value={contactName} onChangeText={setContactName} style={styles.fieldGap} />
          <FieldLabel>Phone *</FieldLabel>
          <Input value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" style={styles.fieldGap} />
          <FieldLabel>Email *</FieldLabel>
          <Input value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" style={styles.fieldGap} />
          <FieldLabel>Role *</FieldLabel>
          <View style={styles.chipRow}>
            {ROLE_OPTIONS.map((r) => (
              <Chip key={r} label={r} active={contactRole === r} onPress={() => setContactRole(r)} />
            ))}
          </View>
          {contactRole === 'Other' && (
            <>
              <FieldLabel>Describe the role *</FieldLabel>
              <Input value={contactRoleOther} onChangeText={setContactRoleOther} style={styles.fieldGap} />
            </>
          )}
        </Card>

        <View style={styles.formActions}>
          <Button label="← Back" variant="ghost" onPress={() => navigation.goBack()} style={styles.flex1} />
          <Button label={rejectedSub ? 'Resubmit for verification →' : 'Submit for verification →'} onPress={submit} disabled={!valid} loading={submitting} style={styles.flex1} />
        </View>
        <Muted style={styles.footerNote}>🔒 reviewed manually by our team · usually approved within 24h</Muted>
      </ScrollView>
    </Screen>
  );
}

function DocBox({ type, label, doc, onPick, flagged, kept }: { type: string; label: string; doc: Doc; onPick: () => void; flagged?: boolean; kept?: boolean }) {
  const isPdf = doc?.mimeType === 'application/pdf';
  return (
    <Pressable style={[styles.docBox, flagged && !doc && styles.docBoxFlagged, kept && styles.docBoxKept]} onPress={onPick}>
      {doc ? (
        isPdf ? (
          <View style={styles.docPdf}>
            <FileText size={22} color={colors.accent} />
            <Txt style={styles.docPdfName} numberOfLines={2}>{doc.name}</Txt>
            <Txt style={styles.docOverlayLabel2}>tap to replace</Txt>
          </View>
        ) : (
          <>
            <Image source={{ uri: doc.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.docOverlay}>
              <Check size={13} color="#fff" />
              <Txt style={styles.docOverlayLabel} numberOfLines={1}>uploaded — tap to replace</Txt>
            </View>
          </>
        )
      ) : kept ? (
        <View style={styles.docKeptInner}>
          <Check size={16} color={colors.accent} />
          <Txt style={styles.docKeptLabel} numberOfLines={2}>{label}</Txt>
          <Muted style={styles.docOverlayLabel2}>kept from before</Muted>
        </View>
      ) : flagged ? (
        <View style={styles.docKeptInner}>
          <RotateCcw size={16} color={colors.danger} />
          <Txt style={[styles.docFlaggedLabel]} numberOfLines={2}>{label}</Txt>
          <Txt style={styles.docFlaggedAction}>{rejectedActionLabel(type)}</Txt>
        </View>
      ) : (
        <Txt style={styles.docLabel}>{label}</Txt>
      )}
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Txt style={styles.fieldLabel}>{children}</Txt>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  centerNote: { textAlign: 'center' },
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  card: { padding: spacing.l, marginBottom: spacing.m },
  rejectCard: { padding: spacing.l, marginBottom: spacing.m, backgroundColor: 'rgba(255,92,73,0.08)', borderColor: colors.danger, borderWidth: 1 },
  rejectHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rejectReason: { color: colors.text, fontSize: fontSize.s, marginBottom: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 4, marginBottom: spacing.s },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  docsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  docBox: { width: 104, height: 104, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.border3, borderStyle: 'dashed', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: spacing.s },
  docBoxFlagged: { borderColor: colors.danger, borderStyle: 'solid', backgroundColor: 'rgba(255,92,73,0.08)' },
  docBoxKept: { borderColor: colors.accent, borderStyle: 'solid', backgroundColor: 'rgba(155,225,61,0.08)' },
  docLabel: { fontSize: 11, textAlign: 'center', color: colors.muted },
  docOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 5 },
  docOverlayLabel: { fontSize: 9.5, color: '#fff', flex: 1 },
  docPdf: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  docPdfName: { fontSize: 10, textAlign: 'center', color: colors.text },
  docOverlayLabel2: { fontSize: 9.5, color: colors.muted },
  docKeptInner: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  docKeptLabel: { fontSize: 10.5, textAlign: 'center', color: colors.text },
  docFlaggedLabel: { fontSize: 10.5, textAlign: 'center', color: colors.text, fontFamily: fontFamily.medium },
  docFlaggedAction: { fontSize: 10, textAlign: 'center', color: colors.danger, fontFamily: fontFamily.bold, marginTop: 2 },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  formActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  flex1: { flex: 1 },
  footerNote: { fontSize: 11, marginTop: spacing.m, textAlign: 'center' },
  statusCard: { padding: spacing.xl, alignItems: 'center', marginTop: spacing.l, gap: spacing.s },
  statusTitle: { fontSize: fontSize.l, marginTop: spacing.s },
});
