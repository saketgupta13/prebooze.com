import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, CreditCard, Lock, Plus, Smartphone, X } from 'lucide-react-native';
import { wallet } from '../../api/wallet';
import { ApiError } from '../../api/client';
import { Button, Chip, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { PayMethod } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const UPI_RE = /^[\w.-]+@[\w]+$/;

/** Mirrors web's PaymentMethods.tsx: UPI or card, set-default, usedCount —
 * auto-renew section omitted (subscription/featured renewals are an
 * organizer/promoter/lineup/venue-only feature, not applicable to this
 * guest-only app). */
export default function PaymentMethodsScreen() {
  const navigation = useNavigation<Nav>();
  const [methods, setMethods] = useState<PayMethod[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<'upi' | 'card'>('upi');
  const [value, setValue] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    wallet.payMethods().then(setMethods).catch(() => setMethods([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => { setValue(''); setHolder(''); setExpiry(''); setCvv(''); setType('upi'); };

  const add = async () => {
    const v = value.trim();
    if (!v) return;
    if (type === 'upi' && !UPI_RE.test(v)) return Alert.alert('Enter a valid UPI id, e.g. name@upi');
    if (type === 'card') {
      if (v.replace(/\D/g, '').length < 12) return Alert.alert('Enter a valid card number');
      if (!holder.trim()) return Alert.alert('Card holder name is required');
      if (!/^\d{2}\/\d{2}$/.test(expiry)) return Alert.alert('Enter expiry as MM/YY');
      if (cvv.replace(/\D/g, '').length !== 3) return Alert.alert('Enter the 3-digit CVV');
    }
    const label = type === 'upi' ? v : `Card •••• ${v.replace(/\D/g, '').slice(-4)}`;
    setSaving(true);
    try {
      await wallet.addPayMethod(type === 'upi' ? { type, label } : { type, label, holder: holder.trim(), expiry, cvvToken: cvv });
      resetForm();
      setAdding(false);
      load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (m: PayMethod) => {
    Alert.alert('Remove this payment method?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await wallet.removePayMethod(m.id).catch(() => {}); load(); } },
    ]);
  };

  const makeDefault = async (m: PayMethod) => {
    await wallet.setDefault(m.id).catch(() => {});
    load();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Payment methods</Txt>
      </View>

      {!methods && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {methods && (
        <View style={styles.content}>
          {methods.length === 0 && <Muted style={{ marginBottom: spacing.m }}>Nothing saved yet — add a UPI id or card below.</Muted>}
          {methods.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={styles.rowIcon}>
                {m.type === 'upi' ? <Smartphone size={18} color={colors.accent} /> : <CreditCard size={18} color={colors.accent} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.rowLabel}>{m.label}</Txt>
                <Muted style={styles.rowMeta}>
                  {m.type.toUpperCase()}{m.holder ? ` · ${m.holder}` : ''}{m.expiry ? ` · exp ${m.expiry}` : ''}
                  {m.usedCount ? ` · used ${m.usedCount}× at checkout` : ''}
                </Muted>
              </View>
              {m.isDefault ? (
                <View style={styles.defaultBadge}>
                  <Txt style={styles.defaultBadgeTxt}>Default</Txt>
                  <CheckCircle2 size={12} color={colors.accent} />
                </View>
              ) : (
                <Pressable onPress={() => makeDefault(m)}><Txt style={styles.makeDefaultTxt}>Make default</Txt></Pressable>
              )}
              <Pressable onPress={() => remove(m)} hitSlop={10} style={{ marginLeft: spacing.s }}>
                <X size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.addRow} onPress={() => setAdding(true)}>
            <Plus size={16} color={colors.muted} />
            <Txt style={styles.addLabel}>Add payment method</Txt>
          </Pressable>
        </View>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalSheet}>
            <Txt style={styles.modalTitle}>Add a method</Txt>

            <View style={styles.typeRow}>
              <Chip label="UPI" active={type === 'upi'} onPress={() => setType('upi')} />
              <Chip label="Card" active={type === 'card'} onPress={() => setType('card')} />
            </View>

            <Txt style={styles.fieldLabel}>{type === 'upi' ? 'UPI id' : 'Card number'}</Txt>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={type === 'upi' ? 'name@upi' : '4242 4242 4242 4242'}
              keyboardType={type === 'card' ? 'number-pad' : 'default'}
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            {type === 'card' && (
              <>
                <Txt style={styles.fieldLabel}>Card holder name</Txt>
                <TextInput value={holder} onChangeText={setHolder} placeholder="As printed on the card" placeholderTextColor={colors.muted} style={styles.input} />
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.fieldLabel}>Expiry</Txt>
                    <TextInput
                      value={expiry}
                      onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 4); setExpiry(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d); }}
                      placeholder="MM/YY"
                      keyboardType="number-pad"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.fieldLabel}>CVV</Txt>
                    <TextInput
                      value={cvv}
                      onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 3))}
                      placeholder="•••"
                      keyboardType="number-pad"
                      secureTextEntry
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.lockRow}>
              <Lock size={11} color={colors.muted} />
              <Muted style={styles.lockTxt}>{type === 'card' ? 'CVV is verified at charge time, never stored' : 'UPI ID is verified via your UPI app, never stored'}</Muted>
            </View>

            <Button label={saving ? 'Saving…' : 'Save method'} loading={saving} onPress={add} style={{ marginTop: spacing.m }} />
            <Button label="Cancel" variant="ghost" onPress={() => { resetForm(); setAdding(false); }} style={{ marginTop: spacing.s }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m, marginBottom: spacing.m },
  rowIcon: { width: 40, height: 40, borderRadius: radius.m, backgroundColor: 'rgba(155,225,61,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  rowMeta: { fontSize: fontSize.xs },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(155,225,61,0.12)', borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 4 },
  defaultBadgeTxt: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  makeDefaultTxt: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s, borderWidth: 1.5, borderColor: colors.border3, borderStyle: 'dashed', borderRadius: radius.m, padding: spacing.l },
  addLabel: { color: colors.muted, fontFamily: fontFamily.bold, fontSize: fontSize.m },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, padding: spacing.l, paddingBottom: spacing.xl },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.m },
  typeRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  fieldLabel: { fontSize: fontSize.xs, color: colors.muted, marginBottom: 4, marginTop: spacing.s },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.l,
  },
  cardRow: { flexDirection: 'row', gap: spacing.s },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.m },
  lockTxt: { fontSize: fontSize.xs },
});
