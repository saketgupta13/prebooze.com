import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { Input, Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** RN equivalent of prebooze-web/src/components/SearchableSelect.tsx — a
 * type-to-filter picker (venues, cities, line-up & partners), since there's
 * no native <select> with search built in. A tap opens a full-screen modal
 * instead of an inline dropdown — more reliable than an absolutely-
 * positioned popover across every device/keyboard-avoiding-view combo.
 * `fieldStyle`/`fieldTextStyle`/`chevronColor` let a caller restyle just the
 * trigger (e.g. Scanner's translucent overlay pill on the camera view)
 * without touching every other call site's default look. */
export default function SearchableSelect({
  value, onChange, options, placeholder, fieldStyle, fieldTextStyle, chevronColor, allowFreeText,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
  fieldStyle?: StyleProp<ViewStyle>; fieldTextStyle?: StyleProp<TextStyle>; chevronColor?: string;
  // Real gap closed 2026-09-28: same as web's own SearchableSelect — a typed
  // query with no exact match shows an extra "+ Add" row that calls
  // onChange with the raw typed text, for co-organizer/lineup/venue entries
  // not yet registered on Prebooze.
  allowFreeText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === q.trim().toLowerCase());
  const showFreeTextOption = allowFreeText && q.trim().length > 1 && !exactMatch;
  const listData = showFreeTextOption ? [...filtered, `__freetext__${q.trim()}`] : filtered;

  return (
    <>
      <Pressable style={[styles.field, fieldStyle]} onPress={() => { setQ(''); setOpen(true); }}>
        <Txt style={[value ? styles.value : styles.placeholder, fieldTextStyle]} numberOfLines={1}>{value || placeholder || 'Select…'}</Txt>
        <ChevronDown size={16} color={chevronColor ?? colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={styles.searchWrap}>
              <Search size={14} color={colors.muted} style={styles.searchIcon} />
              <Input value={q} onChangeText={setQ} placeholder={placeholder ?? 'search…'} autoFocus style={styles.searchInput} />
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={listData}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isFreeText = item.startsWith('__freetext__');
              const raw = isFreeText ? item.slice('__freetext__'.length) : item;
              return (
                <Pressable style={styles.option} onPress={() => { onChange(raw); setOpen(false); }}>
                  <Txt style={isFreeText ? { color: colors.accent, fontFamily: fontFamily.bold } : undefined}>
                    {isFreeText ? `+ Add "${raw}" (not on Prebooze yet)` : item}
                  </Txt>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Muted style={styles.empty}>No matches</Muted>}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m,
  },
  value: { fontSize: fontSize.l, color: colors.text, flex: 1 },
  placeholder: { fontSize: fontSize.l, color: colors.muted, flex: 1 },
  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, marginBottom: spacing.m },
  searchWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: spacing.m, zIndex: 1 },
  searchInput: { paddingLeft: 32 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  option: { paddingHorizontal: spacing.l, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.border },
  empty: { textAlign: 'center', padding: spacing.xl },
});
