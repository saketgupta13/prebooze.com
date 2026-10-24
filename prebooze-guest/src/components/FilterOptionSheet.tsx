import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Generic single-level option-picker bottom sheet — same slide-up modal
 * pattern as CityPickerModal, reused for Browse's Price/Sort filters so
 * they read as a real "dropdown" (tap to open a sheet, pick one, it
 * closes) instead of a horizontal chip row competing for space with
 * Category/Date on a phone-width screen, same as web's <select> dropdowns
 * for these two. */
export default function FilterOptionSheet<T extends string>({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Txt style={styles.title}>{title}</Txt>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item.value === selected && styles.rowActive]}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Txt style={[styles.rowLabel, item.value === selected && styles.rowLabelActive]}>{item.label}</Txt>
                {item.value === selected && <Check size={16} color={colors.accent} />}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, padding: spacing.l, paddingBottom: spacing.xl, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.m, paddingHorizontal: spacing.s, borderRadius: radius.m },
  rowActive: { backgroundColor: 'rgba(155,225,61,0.08)' },
  rowLabel: { fontSize: fontSize.m },
  rowLabelActive: { fontFamily: fontFamily.bold, color: colors.accent },
});
