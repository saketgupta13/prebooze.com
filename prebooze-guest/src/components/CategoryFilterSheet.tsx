import { useState, useEffect } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Two-level category → sub-category picker, same dropdown-sheet pattern
 * as FilterOptionSheet but with a drill-down page for subs — mirrors web's
 * Browse.tsx having a category <select> and a conditional sub-category
 * chip row that appears once a category's picked, just folded into one
 * sheet instead of a second row competing for screen space. */
export default function CategoryFilterSheet({
  visible, categories, cat, sub, onSelect, onClose,
}: {
  visible: boolean;
  categories: { name: string; subs: string[] }[];
  cat: string;
  sub: string;
  onSelect: (cat: string, sub: string) => void;
  onClose: () => void;
}) {
  // Opens straight into sub-categories if a category with subs is already
  // selected — picking a different category resets back to the top level.
  const [drill, setDrill] = useState(false);

  useEffect(() => {
    if (visible) setDrill(false);
  }, [visible]);

  const current = categories.find((c) => c.name === cat);
  const showingSubs = drill && !!current && current.subs.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {showingSubs ? (
              <Pressable onPress={() => setDrill(false)} style={styles.backBtn}>
                <ArrowLeft size={16} color={colors.text} />
                <Txt style={styles.title}>{cat}</Txt>
              </Pressable>
            ) : (
              <Txt style={styles.title}>Category</Txt>
            )}
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {!showingSubs && (
            <FlatList
              data={[{ name: '', subs: [] as string[] }, ...categories]}
              keyExtractor={(c) => c.name || 'all'}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, item.name === cat && styles.rowActive]}
                  onPress={() => {
                    if (item.name && item.subs.length > 0) { onSelect(item.name, ''); setDrill(true); }
                    else { onSelect(item.name, ''); onClose(); }
                  }}
                >
                  <Txt style={[styles.rowLabel, item.name === cat && styles.rowLabelActive]}>{item.name || 'All categories'}</Txt>
                  {item.name === cat && <Check size={16} color={colors.accent} />}
                </Pressable>
              )}
            />
          )}

          {showingSubs && (
            <FlatList
              data={['', ...current!.subs]}
              keyExtractor={(s) => s || 'all'}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.row, item === sub && styles.rowActive]}
                  onPress={() => { onSelect(cat, item); onClose(); }}
                >
                  <Txt style={[styles.rowLabel, item === sub && styles.rowLabelActive]}>{item || `All ${cat}`}</Txt>
                  {item === sub && <Check size={16} color={colors.accent} />}
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, padding: spacing.l, paddingBottom: spacing.xl, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.m, paddingHorizontal: spacing.s, borderRadius: radius.m },
  rowActive: { backgroundColor: 'rgba(155,225,61,0.08)' },
  rowLabel: { fontSize: fontSize.m },
  rowLabelActive: { fontFamily: fontFamily.bold, color: colors.accent },
});
