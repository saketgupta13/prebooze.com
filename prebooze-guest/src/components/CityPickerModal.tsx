import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MapPin, Search, X } from 'lucide-react-native';
import { catalog } from '../api/catalog';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

interface CityRow { name: string; top: boolean; events: number }

export default function CityPickerModal({ visible, currentCity, onClose, onSelect }: {
  visible: boolean;
  currentCity: string;
  onClose: () => void;
  onSelect: (city: string) => void;
}) {
  const [cities, setCities] = useState<CityRow[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    catalog.cities().then(setCities).catch(() => setCities([]));
  }, [visible]);

  // Only cities with at least one live (upcoming) event — a city can be
  // "enabled" admin-side with zero bookable events, which would otherwise
  // dead-end a guest in an empty city with nothing to browse.
  const filtered = (cities ?? [])
    .filter((c) => c.events > 0 || c.name === currentCity)
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Txt style={styles.title}>Choose your city</Txt>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Search size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search city..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoFocus
            />
          </View>

          {!cities && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.name}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={cities ? <Muted style={{ textAlign: 'center', padding: spacing.l }}>No matching city.</Muted> : null}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item.name === currentCity && styles.rowActive]}
                onPress={() => { onSelect(item.name); onClose(); }}
              >
                <MapPin size={16} color={item.name === currentCity ? colors.accent : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Txt style={styles.rowName}>{item.name}</Txt>
                  <Muted style={styles.rowMeta}>{item.events} events{item.top ? ' · popular' : ''}</Muted>
                </View>
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
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.l, paddingVertical: spacing.m, marginBottom: spacing.m,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m, paddingHorizontal: spacing.s, borderRadius: radius.m },
  rowActive: { backgroundColor: 'rgba(155,225,61,0.08)' },
  rowName: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  rowMeta: { fontSize: fontSize.xs },
});
