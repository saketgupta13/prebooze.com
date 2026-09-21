import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ArrowLeft, Calendar, Check, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, Checkbox, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { isEventOver } from '../../lib/events';
import type { MoreStackParamList } from '../../navigation/types';
import type { Coupon, Event } from '../../types';

const formatDateDMY = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const GENDER_OPTIONS: { key: Coupon['gender']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'other', label: 'Other' },
];
const audienceLabel = (g: Coupon['gender']) => (g === 'women' ? 'women only' : g === 'men' ? 'men only' : g === 'other' ? 'other' : 'all');

const defaultValidTill = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d; };

/** Faithful port of prebooze-web/src/pages/organizer/Coupons.tsx — same
 * eventScope-matched-by-title semantics (server-enforced, not client), same
 * defaults. A real DELETE /organizer/coupons/:id was added 2026-09-21 (a
 * user ask, not a web port) — pause was the only retirement option until
 * then; Coupon has no redemption join table so a hard delete is safe. Web
 * doesn't have this yet — flag the same addition there if asked. */
export default function CouponsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'flat'>('flat');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('500');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [eventScope, setEventScope] = useState('all');
  const [validTill, setValidTill] = useState(defaultValidTill());
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<Coupon['gender']>('all');
  const [firstTimeOnly, setFirstTimeOnly] = useState(false);
  const [formErr, setFormErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([organizer.coupons(), organizer.events()])
        .then(([cs, evs]) => { if (!cancelled) { setCoupons(cs); setEvents(evs); } })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setType('flat');
    setValue('');
    setMaxDiscount('');
    setUsageLimit('500');
    setPerUserLimit('1');
    setEventScope('all');
    setValidTill(defaultValidTill());
    setDescription('');
    setGender('all');
    setFirstTimeOnly(false);
    setFormErr('');
  };

  const startEdit = (c: Coupon) => {
    setEditingId(c.id);
    setCode(c.code);
    setType(c.type);
    setValue(String(c.value));
    setMaxDiscount(c.maxDiscount ? String(c.maxDiscount) : '');
    setUsageLimit(String(c.usageLimit));
    setPerUserLimit(String(c.perUserLimit));
    setEventScope(c.eventScope);
    setValidTill(c.validTill ? new Date(c.validTill) : defaultValidTill());
    setDescription(c.description ?? '');
    setGender(c.gender);
    setFirstTimeOnly(c.firstTimeOnly);
    setFormErr('');
    setShowForm(true);
  };

  const reload = () => Promise.all([organizer.coupons(), organizer.events()]).then(([cs, evs]) => { setCoupons(cs); setEvents(evs); });

  const save = async () => {
    setFormErr('');
    if (!code.trim()) return setFormErr('Coupon code is required');
    if (!(+value > 0)) return setFormErr('Discount value must be positive');
    setBusy(true);
    try {
      await organizer.upsertCoupon({
        id: editingId ?? undefined,
        code: code.trim().toUpperCase(),
        type,
        value: +value,
        maxDiscount: type === 'percent' && maxDiscount ? +maxDiscount : undefined,
        usageLimit: +usageLimit || 500,
        perUserLimit: +perUserLimit || 1,
        eventScope,
        validTill: validTill.toISOString(),
        description: description.trim() || undefined,
        gender,
        firstTimeOnly,
      });
      resetForm();
      setShowForm(false);
      await reload();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : 'Failed to save coupon');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (c: Coupon) => {
    try {
      await organizer.upsertCoupon({ id: c.id, status: c.status === 'active' ? 'paused' : 'active' });
      await reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  const remove = (c: Coupon) => {
    Alert.alert('Delete this promo code?', `"${c.code}" will stop working immediately — this can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await organizer.deleteCoupon(c.id);
            await reload();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: validTill,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, selected) => { if (event.type === 'set' && selected) setValidTill(selected); },
    });
  };

  // Real bug (2026-09-18): a new coupon is only ever useful against a
  // still-bookable event, but this included events long over — same
  // isEventOver (date + durationHrs) check already used by Bookings.tsx/
  // Dashboard.tsx/EventsScreen.tsx/etc.
  const approvedEvents = events.filter((e) => e.status === 'approved' && !isEventOver(e));

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Promo codes</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Button
          label={showForm ? 'Hide form' : '+ Create promo code'}
          variant={showForm ? 'ghost' : 'primary'}
          onPress={() => { if (showForm) resetForm(); setShowForm((s) => !s); }}
          style={{ marginBottom: spacing.m }}
        />

        {showForm && (
          <Card style={styles.formCard}>
            {!!formErr && (
              <View style={styles.errRow}>
                <X size={14} color={colors.danger} />
                <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{formErr}</Txt>
              </View>
            )}
            <FieldLabel>Code</FieldLabel>
            <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="FIRST50" editable={!editingId} autoCapitalize="characters" style={styles.fieldGap} />

            <FieldLabel>Type</FieldLabel>
            <View style={styles.chipRow}>
              <Chip label="% off" active={type === 'percent'} onPress={() => setType('percent')} />
              <Chip label="flat ₹ off" active={type === 'flat'} onPress={() => setType('flat')} />
            </View>

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <FieldLabel>{type === 'percent' ? '% value' : '₹ value'}</FieldLabel>
                <Input value={value} onChangeText={setValue} placeholder={type === 'percent' ? 'e.g. 20' : 'e.g. 100'} keyboardType="number-pad" style={styles.fieldGap} />
              </View>
              {type === 'percent' && (
                <View style={styles.flex1}>
                  <FieldLabel>Max discount ₹ (optional)</FieldLabel>
                  <Input value={maxDiscount} onChangeText={setMaxDiscount} placeholder="e.g. 500" keyboardType="number-pad" style={styles.fieldGap} />
                </View>
              )}
            </View>

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <FieldLabel>Usage limit</FieldLabel>
                <Input value={usageLimit} onChangeText={setUsageLimit} keyboardType="number-pad" style={styles.fieldGap} />
              </View>
              <View style={styles.flex1}>
                <FieldLabel>Per user</FieldLabel>
                <Input value={perUserLimit} onChangeText={setPerUserLimit} keyboardType="number-pad" style={styles.fieldGap} />
              </View>
            </View>

            <FieldLabel>Events</FieldLabel>
            <SearchableSelect
              value={eventScope === 'all' ? 'All' : eventScope}
              onChange={(v) => setEventScope(v === 'All' ? 'all' : v)}
              options={['All', ...approvedEvents.map((e) => e.title)]}
              placeholder="select an event…"
            />

            <FieldLabel>Valid till</FieldLabel>
            <Pressable style={[styles.pickerField, styles.fieldGap]} onPress={openDatePicker}>
              <Txt>{formatDateDMY(validTill)}</Txt>
              <Calendar size={16} color={colors.muted} />
            </Pressable>

            <FieldLabel>Note (optional, for your own reference)</FieldLabel>
            <Input value={description} onChangeText={setDescription} placeholder="e.g. Instagram launch promo" style={styles.fieldGap} />

            <FieldLabel>Audience — gender</FieldLabel>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <Chip key={g.key} label={gender === g.key ? `${g.label} ✓` : g.label} active={gender === g.key} onPress={() => setGender(g.key)} />
              ))}
            </View>
            <Muted style={styles.tiny}>
              checked against verified profile gender at checkout · gender-targeted codes enable ladies-night pricing without separate tiers
            </Muted>

            <View style={{ marginTop: spacing.m }}>
              <Checkbox checked={firstTimeOnly} onChange={setFirstTimeOnly} label="First-time users only" />
            </View>

            <View style={styles.formActions}>
              {!!editingId && <Button label="Cancel" variant="ghost" onPress={() => { resetForm(); setShowForm(false); }} style={styles.flex1} />}
              <Button label={busy ? 'Saving…' : editingId ? 'Save changes ✓' : 'Save coupon'} onPress={save} loading={busy} style={styles.flex1} />
            </View>
          </Card>
        )}

        <Card style={styles.listCard}>
          <Txt style={styles.bold}>Promo codes</Txt>
          {loading && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>Loading…</Muted>}
          {!loading && coupons.length === 0 && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>No promo codes yet.</Muted>}
          {coupons.map((c, i) => (
            <View key={c.id} style={[styles.couponRow, i < coupons.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.couponHead}>
                  <Txt style={styles.bold}>{c.code}</Txt>
                  <Badge label={c.status === 'active' ? 'Active' : 'Paused'} tone={c.status === 'active' ? 'success' : 'default'} />
                </View>
                <Muted style={styles.tiny}>
                  {c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ''}` : `flat ₹${c.value} off`}
                  {c.firstTimeOnly ? ' · first-time users' : ''}
                  {c.gender !== 'all' ? ` · ${audienceLabel(c.gender)}` : ''}
                </Muted>
                <Muted style={styles.tiny}>
                  used {c.used}/{c.usageLimit} · {c.eventScope === 'all' ? 'all events' : c.eventScope} · valid till {formatDateDMY(new Date(c.validTill))}
                  {c.description ? ` · ${c.description}` : ''}
                </Muted>
                <View style={styles.couponActions}>
                  <Chip label={c.status === 'active' ? 'Pause' : 'Resume'} onPress={() => toggleStatus(c)} />
                  <Chip label="Edit" onPress={() => startEdit(c)} />
                  <Chip label="Delete" onPress={() => remove(c)} />
                </View>
              </View>
            </View>
          ))}
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
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  formCard: { padding: spacing.l, marginBottom: spacing.m },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  row2: { flexDirection: 'row', gap: spacing.s },
  flex1: { flex: 1 },
  pickerField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.l, paddingVertical: spacing.m },
  tiny: { fontSize: 11.5, marginTop: 4 },
  formActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  listCard: { padding: spacing.l },
  centerNote: { textAlign: 'center' },
  bold: { fontFamily: fontFamily.bold },
  couponRow: { paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  couponHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: 2 },
  couponActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
});
