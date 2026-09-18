import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Button, Card, Checkbox, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { PaymentProfile } from '../../types';

type Draft = LocationValue & {
  legalName: string; businessAddress: string; bankAccountNumber: string; accountHolderName: string;
  ifsc: string; branch: string; pan: string; gstin: string; noGst: boolean;
};
const emptyDraft = (): Draft => ({ ...emptyLocation(), legalName: '', businessAddress: '', bankAccountNumber: '', accountHolderName: '', ifsc: '', branch: '', pan: '', gstin: '', noGst: false });

/** Faithful port of prebooze-web/src/pages/organizer/PaymentProfiles.tsx —
 * bank accounts to withdraw to, no identity verification required. First
 * profile ever created auto-becomes default server-side; deleting the
 * default auto-promotes the next-oldest remaining one. */
export default function PaymentProfilesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = () => organizer.paymentProfiles().then(setProfiles);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load()
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const startNew = () => { setDraft(emptyDraft()); setEditingId('new'); };
  const startEdit = (p: PaymentProfile) => {
    setDraft({
      legalName: p.legalName, businessAddress: p.businessAddress,
      country: p.country ?? 'India', state: p.state ?? '', city: p.city ?? '', pincode: p.pincode ?? '',
      bankAccountNumber: p.bankAccountNumber, accountHolderName: p.accountHolderName, ifsc: p.ifsc,
      branch: p.branch ?? '', pan: p.pan, gstin: p.gstin ?? '', noGst: !!p.noGst,
    });
    setEditingId(p.id);
  };

  const valid = !!(draft.legalName.trim() && draft.businessAddress.trim() && draft.bankAccountNumber.trim() && draft.accountHolderName.trim() && draft.ifsc.trim() && draft.pan.trim() && (draft.noGst || draft.gstin.trim()));

  const save = async () => {
    setErr('');
    setSaving(true);
    const body = {
      legalName: draft.legalName.trim(), businessAddress: draft.businessAddress.trim(),
      country: draft.country.trim() || undefined, state: draft.state.trim() || undefined, city: draft.city.trim() || undefined, pincode: draft.pincode.trim() || undefined,
      bankAccountNumber: draft.bankAccountNumber.trim(), accountHolderName: draft.accountHolderName.trim(), ifsc: draft.ifsc.trim().toUpperCase(),
      branch: draft.branch.trim() || undefined, pan: draft.pan.trim().toUpperCase(),
      gstin: draft.noGst ? undefined : draft.gstin.trim().toUpperCase(), noGst: draft.noGst,
    };
    try {
      if (editingId === 'new') await organizer.createPaymentProfile(body);
      else if (editingId) await organizer.updatePaymentProfile(editingId, body);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await organizer.setDefaultPaymentProfile(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  const remove = (p: PaymentProfile) => {
    Alert.alert('Remove this payment profile?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await organizer.deletePaymentProfile(p.id);
            await load();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Failed to remove');
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Payment profiles</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>
          Bank accounts you can withdraw to — hold more than one if you invoice under different entities. Withdrawals always pay out to
          whichever is set default. Doesn't require identity verification.
        </Muted>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}

        {profiles.map((p) => (
          editingId === p.id ? (
            <ProfileForm key={p.id} draft={draft} setDraft={setDraft} valid={valid} saving={saving} onSave={save} onCancel={() => setEditingId(null)} />
          ) : (
            <Card key={p.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Txt style={styles.bold} numberOfLines={1}>{p.legalName}</Txt>
                {p.isDefault && <Txt style={styles.defaultLabel}>default</Txt>}
              </View>
              <Muted style={styles.tiny}>•••• {p.bankAccountNumber.slice(-4)} · {p.accountHolderName} · {p.ifsc}</Muted>
              <View style={styles.actionsRow}>
                {!p.isDefault && (
                  <Pressable onPress={() => makeDefault(p.id)}><Txt style={styles.link}>Set default</Txt></Pressable>
                )}
                <Pressable onPress={() => startEdit(p)}><Txt style={styles.link}>Edit</Txt></Pressable>
                <Pressable onPress={() => remove(p)}><Txt style={[styles.link, { color: colors.danger }]}>Remove</Txt></Pressable>
              </View>
            </Card>
          )
        ))}

        {editingId === 'new' ? (
          <ProfileForm draft={draft} setDraft={setDraft} valid={valid} saving={saving} onSave={save} onCancel={() => setEditingId(null)} />
        ) : (
          !loading && <Button label="+ Add payment profile" onPress={startNew} style={{ marginTop: spacing.m }} />
        )}
      </ScrollView>
    </Screen>
  );
}

function ProfileForm({ draft, setDraft, valid, saving, onSave, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; valid: boolean; saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <Card style={styles.card}>
      <FieldLabel>Company / Firm / LLP / Individual name *</FieldLabel>
      <Input value={draft.legalName} onChangeText={(t) => set({ legalName: t })} style={styles.fieldGap} />
      <FieldLabel>Business address *</FieldLabel>
      <Input value={draft.businessAddress} onChangeText={(t) => set({ businessAddress: t })} style={styles.fieldGap} />

      <LocationPicker value={draft} onChange={(v) => set(v)} />

      <View style={styles.row2}>
        <View style={styles.flex1}>
          <FieldLabel>PAN *</FieldLabel>
          <Input value={draft.pan} onChangeText={(t) => set({ pan: t.toUpperCase() })} maxLength={10} autoCapitalize="characters" style={styles.fieldGap} />
        </View>
        <View style={styles.flex1}>
          <FieldLabel>GSTIN *</FieldLabel>
          <Input value={draft.gstin} onChangeText={(t) => set({ gstin: t.toUpperCase() })} maxLength={15} autoCapitalize="characters" editable={!draft.noGst} style={[styles.fieldGap, draft.noGst && styles.fieldDisabled]} />
        </View>
      </View>
      <View style={{ marginTop: spacing.s }}>
        <Checkbox checked={draft.noGst} onChange={(v) => set({ noGst: v })} label="I don't have a GSTIN" />
      </View>

      <View style={[styles.row2, { marginTop: spacing.m }]}>
        <View style={styles.flex1}>
          <FieldLabel>Bank name / Branch</FieldLabel>
          <Input value={draft.branch} onChangeText={(t) => set({ branch: t })} placeholder="e.g. HDFC Bank, Banjara Hills" style={styles.fieldGap} />
        </View>
        <View style={styles.flex1}>
          <FieldLabel>Account holder's name *</FieldLabel>
          <Input value={draft.accountHolderName} onChangeText={(t) => set({ accountHolderName: t })} style={styles.fieldGap} />
        </View>
      </View>
      <View style={styles.row2}>
        <View style={styles.flex1}>
          <FieldLabel>Account number *</FieldLabel>
          <Input value={draft.bankAccountNumber} onChangeText={(t) => set({ bankAccountNumber: t })} keyboardType="number-pad" style={styles.fieldGap} />
        </View>
        <View style={styles.flex1}>
          <FieldLabel>IFSC code *</FieldLabel>
          <Input value={draft.ifsc} onChangeText={(t) => set({ ifsc: t.toUpperCase() })} autoCapitalize="characters" style={styles.fieldGap} />
        </View>
      </View>

      <View style={styles.formActions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} style={styles.flex1} />
        <Button label={saving ? 'Saving…' : 'Save'} onPress={onSave} loading={saving} disabled={!valid} style={styles.flex1} />
      </View>
    </Card>
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
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  centerNote: { textAlign: 'center' },
  card: { padding: spacing.l, marginBottom: spacing.m },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: 2 },
  bold: { fontFamily: fontFamily.bold },
  defaultLabel: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.accent },
  tiny: { fontSize: 11.5 },
  actionsRow: { flexDirection: 'row', gap: spacing.l, marginTop: spacing.s },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 12.5 },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  fieldDisabled: { opacity: 0.5 },
  row2: { flexDirection: 'row', gap: spacing.s },
  flex1: { flex: 1 },
  formActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
});
