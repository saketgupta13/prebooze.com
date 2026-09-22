import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, CreditCard, Lock, Smartphone, X } from 'lucide-react-native';
import { wallet } from '../../api/wallet';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { PayMethod } from '../../types';

/** Port of prebooze-web/src/pages/PaymentMethods.tsx — saved UPI/cards for
 * one-tap checkout, shared across every role (not organizer-specific, same
 * /pay-methods endpoint the guest side uses). The web page's Auto-renew
 * toggle is deliberately dropped here: it was for subscription billing,
 * which [[razorpay_complete_removal]] took out entirely — kept in web only
 * as a vestigial field, not worth porting dead functionality. */
export default function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [type, setType] = useState<'upi' | 'card'>('upi');
  const [value, setValue] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => wallet.payMethods().then(setMethods);

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

  const add = async () => {
    setFormErr('');
    const v = value.trim();
    if (!v) return;
    if (type === 'upi' && !/^[\w.-]+@[\w]+$/.test(v)) { setFormErr('Enter a valid UPI id, e.g. name@upi'); return; }
    if (type === 'card') {
      if (v.replace(/\D/g, '').length < 12) { setFormErr('Enter a valid card number'); return; }
      if (!holder.trim()) { setFormErr("Card holder name is required"); return; }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) { setFormErr('Enter expiry as MM/YY'); return; }
    }
    const label = type === 'upi' ? v : `Card •••• ${v.replace(/\D/g, '').slice(-4)}`;
    setSaving(true);
    try {
      await wallet.addPayMethod(type === 'upi' ? { type, label } : { type, label, holder: holder.trim(), expiry });
      setValue(''); setHolder(''); setExpiry('');
      await load();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await wallet.removePayMethod(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove');
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await wallet.setDefault(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Payment methods</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>Save UPI or cards for one-tap checkout.</Muted>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Card style={styles.card}>
          <Txt style={styles.bold}>Saved methods ({methods.length})</Txt>
          {loading && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>Loading…</Muted>}
          {!loading && methods.length === 0 && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>Nothing saved yet — add a UPI id or card below.</Muted>}
          {methods.map((m, i) => (
            <View key={m.id} style={[styles.methodRow, i < methods.length - 1 && styles.rowBorder]}>
              {m.type === 'upi' ? <Smartphone size={18} color={colors.muted} /> : <CreditCard size={18} color={colors.muted} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={styles.bold} numberOfLines={1}>{m.label}</Txt>
                <Muted style={styles.tiny}>
                  {m.type.toUpperCase()}{m.holder ? ` · ${m.holder}` : ''}{m.expiry ? ` · exp ${m.expiry}` : ''}
                  {m.usedCount ? ` · used ${m.usedCount}× at checkout` : ''}
                </Muted>
              </View>
              {m.isDefault ? (
                <View style={styles.defaultBadge}>
                  <Txt style={styles.defaultText}>Default</Txt>
                  <CheckCircle2 size={13} color={colors.accent} />
                </View>
              ) : (
                <Pressable onPress={() => makeDefault(m.id)}><Txt style={styles.link}>Make default</Txt></Pressable>
              )}
              <Pressable onPress={() => remove(m.id)} style={{ marginLeft: spacing.s }}><X size={16} color={colors.danger} /></Pressable>
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <Txt style={styles.bold}>Add a method</Txt>
          {!!formErr && (
            <View style={[styles.errRow, { marginTop: spacing.s }]}>
              <X size={14} color={colors.danger} />
              <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{formErr}</Txt>
            </View>
          )}
          <View style={[styles.chipRow, { marginTop: spacing.m }]}>
            <Chip label="UPI" active={type === 'upi'} onPress={() => setType('upi')} />
            <Chip label="Card" active={type === 'card'} onPress={() => setType('card')} />
          </View>
          <FieldLabel>{type === 'upi' ? 'UPI id' : 'Card number'}</FieldLabel>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={type === 'upi' ? 'name@upi' : '4242 4242 4242 4242'}
            keyboardType={type === 'card' ? 'number-pad' : 'default'}
            autoCapitalize="none"
            style={styles.fieldGap}
          />
          {type === 'card' && (
            <View style={styles.row2}>
              <View style={styles.flex1}>
                <FieldLabel>Card holder name</FieldLabel>
                <Input value={holder} onChangeText={setHolder} placeholder="As printed on the card" style={styles.fieldGap} />
              </View>
              <View style={{ width: 110 }}>
                <FieldLabel>Expiry</FieldLabel>
                <Input
                  value={expiry}
                  onChangeText={(t) => { const d = t.replace(/[^\d]/g, '').slice(0, 4); setExpiry(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d); }}
                  placeholder="MM/YY"
                  keyboardType="number-pad"
                  style={styles.fieldGap}
                />
              </View>
            </View>
          )}
          <Button label={saving ? 'Saving…' : 'Save method'} onPress={add} loading={saving} style={{ marginTop: spacing.m }} />
          <View style={styles.lockRow}>
            <Lock size={11} color={colors.muted} />
            <Muted style={styles.tiny}>CVV is verified at checkout, never stored</Muted>
          </View>
        </Card>
      </ScrollView>
    </Screen>
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
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  defaultText: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.accent },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 12.5 },
  chipRow: { flexDirection: 'row', gap: spacing.s },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.m },
  fieldGap: { marginBottom: 0 },
  row2: { flexDirection: 'row', gap: spacing.s },
  flex1: { flex: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.s },
});
