import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, BadgeCheck, Check, Shield, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { kyc } from '../../api/kyc';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { Organizer } from '../../types';

const ROLE_OPTIONS = ['Owner', 'Manager', 'Accountant', 'Other'];

type Doc = { uri: string; name: string; mimeType: string } | null;

/** Faithful port of prebooze-web/src/pages/organizer/OrganizerVerification.tsx
 * — identity-only badge (doesn't affect withdrawals, see PaymentProfiles for
 * that). One deliberate platform difference: web accepts "image/*,.pdf" for
 * documents via a browser file input; RN only has expo-image-picker
 * installed (no document-picker yet), so documents here are photo/gallery
 * only — a real PDF upload would need a native rebuild to add
 * expo-document-picker, not done here since it wasn't asked for. */
export default function VerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [pending, setPending] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([organizer.me(), kyc.myStatus()])
        .then(([me, subs]) => {
          if (cancelled) return;
          setOrg(me);
          setPending(subs.some((s) => s.kind === 'organizer' && s.status === 'pending'));
        })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const pick = async (setter: (d: Doc) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setter({ uri: a.uri, name: a.fileName ?? `upload-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  const docsValid = entityType === 'individual' ? !!aadhaar : entityType === 'firm' ? !!registration && !!ownerAadhaar : false;
  const contactValid = !!(contactName.trim() && contactPhone.trim() && contactEmail.trim() && contactRole && (contactRole !== 'Other' || contactRoleOther.trim()));
  const valid = !!entityType && docsValid && !!selfie && contactValid;

  const submit = async () => {
    if (!valid || !entityType) return;
    setErr('');
    setSubmitting(true);
    try {
      const docLabels = entityType === 'individual' ? ['aadhaar', 'selfie'] : ['registration', 'ownerAadhaar', 'selfie'];
      const docs = (entityType === 'individual' ? [aadhaar, selfie] : [registration, ownerAadhaar, selfie]).filter((d): d is NonNullable<Doc> => !!d);
      await kyc.submitOrganizerVerification(
        { entityType, contactName: contactName.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim(), contactRole, contactRoleOther: contactRole === 'Other' ? contactRoleOther.trim() : undefined, docLabels },
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
                <DocBox label="Aadhaar card" doc={aadhaar} onPick={() => pick(setAadhaar)} />
              ) : (
                <>
                  <DocBox label="Business registration" doc={registration} onPick={() => pick(setRegistration)} />
                  <DocBox label="Owner's Aadhaar card" doc={ownerAadhaar} onPick={() => pick(setOwnerAadhaar)} />
                </>
              )}
              <DocBox label="Selfie" doc={selfie} onPick={() => pick(setSelfie)} />
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
          <Button label="Submit for verification →" onPress={submit} disabled={!valid} loading={submitting} style={styles.flex1} />
        </View>
        <Muted style={styles.footerNote}>🔒 reviewed manually by our team · usually approved within 24h</Muted>
      </ScrollView>
    </Screen>
  );
}

function DocBox({ label, doc, onPick }: { label: string; doc: Doc; onPick: () => void }) {
  return (
    <Pressable style={styles.docBox} onPress={onPick}>
      {doc ? (
        <>
          <Image source={{ uri: doc.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.docOverlay}>
            <Check size={13} color="#fff" />
            <Txt style={styles.docOverlayLabel} numberOfLines={1}>uploaded — tap to replace</Txt>
          </View>
        </>
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
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 4, marginBottom: spacing.s },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  docsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  docBox: { width: 104, height: 104, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.border3, borderStyle: 'dashed', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: spacing.s },
  docLabel: { fontSize: 11, textAlign: 'center', color: colors.muted },
  docOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 5 },
  docOverlayLabel: { fontSize: 9.5, color: '#fff', flex: 1 },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  formActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  flex1: { flex: 1 },
  footerNote: { fontSize: 11, marginTop: spacing.m, textAlign: 'center' },
  statusCard: { padding: spacing.xl, alignItems: 'center', marginTop: spacing.l, gap: spacing.s },
  statusTitle: { fontSize: fontSize.l, marginTop: spacing.s },
});
