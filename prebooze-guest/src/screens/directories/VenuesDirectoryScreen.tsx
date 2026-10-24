import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck, ChevronDown, Heart, Search } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { useCity } from '../../context/CityContext';
import FilterOptionSheet from '../../components/FilterOptionSheet';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Venue } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Same dynamic-band logic as Browse.tsx's priceBands — real bug fixed
 * 2026-10-19: the old filter was 3 hardcoded buckets (Under 500 / 500–2500
 * / 2500+) that made no sense once venue capacities in a city clustered
 * outside that range. Band edges are derived from the real min/max
 * capacity actually on screen right now, split into 3 equal-width bands. */
function capacityBands(capacities: number[]): { label: string; test: (c: number) => boolean }[] | null {
  if (capacities.length === 0) return null;
  const min = Math.min(...capacities);
  const max = Math.max(...capacities);
  if (min === max) return null;
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const low = round10(min + (max - min) / 3);
  const high = round10(min + (2 * (max - min)) / 3);
  if (low === min || high === low) return null;
  return [
    { label: `Under ${low}`, test: (c) => c < low },
    { label: `${low}–${high}`, test: (c) => c >= low && c <= high },
    { label: `${high}+`, test: (c) => c > high },
  ];
}

export default function VenuesDirectoryScreen() {
  const navigation = useNavigation<Nav>();
  const { city } = useCity();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [search, setSearch] = useState('');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [capIdx, setCapIdx] = useState(0);
  const [openSheet, setOpenSheet] = useState<'type' | 'capacity' | null>(null);

  useFocusEffect(useCallback(() => {
    catalog.venues(city).then(setVenues).catch(() => setVenues([]));
    social.mySocialState().then((s) => {
      setFavourites(new Set(s.favouriteVenues));
      setFollowing(new Set(s.following));
    }).catch(() => {});
  }, [city]));

  useEffect(() => {
    catalog.venueTypes().then((rows) => setTypes(rows.map((r) => r.name))).catch(() => setTypes([]));
  }, []);

  // v.type is a comma-joined multi-select string (e.g. "Nightclub, Rooftop")
  // — match if the selected filter is one of the venue's types, not an
  // exact-equal on the whole string. Same as web's Venues.tsx.
  const preCap = (venues ?? [])
    .filter((v) => v.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((v) => !type || v.type.split(',').map((t) => t.trim()).includes(type));
  const capBands = capacityBands(preCap.map((v) => v.capacity));
  const filtered = capBands && capIdx > 0 ? preCap.filter((v) => capBands[capIdx - 1]?.test(v.capacity)) : preCap;

  const toggleFav = (venueId: string) => {
    const was = favourites.has(venueId);
    setFavourites((s) => { const next = new Set(s); was ? next.delete(venueId) : next.add(venueId); return next; });
    social.favVenue(venueId, !was).catch(() => {
      setFavourites((s) => { const next = new Set(s); was ? next.add(venueId) : next.delete(venueId); return next; });
    });
  };

  const toggleFollow = (key: string) => {
    const was = following.has(key);
    setFollowing((s) => { const next = new Set(s); was ? next.delete(key) : next.add(key); return next; });
    (was ? social.unfollow(key) : social.follow(key)).catch(() => {
      setFollowing((s) => { const next = new Set(s); was ? next.add(key) : next.delete(key); return next; });
    });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Venues in {city}</Txt>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={colors.muted} style={{ marginRight: spacing.s }} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search venues..." placeholderTextColor={colors.muted} style={styles.searchInput} textAlignVertical="center" />
      </View>

      {/* Dropdown sheets, not chip rows — see Browse.tsx's own doc comment
          on the same pattern (and the two real layout bugs fixed there:
          wrapping grows the screen taller when a label gets longer, and a
          bare horizontal ScrollView can stretch its own height to fill the
          parent column on Android/Yoga — flexGrow:0 on the ScrollView
          itself, not just alignItems on its content, is what actually
          fixes the second one). */}
      {(types.length > 0 || !!capBands) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRowFix} contentContainerStyle={styles.dropdownRow}>
          {types.length > 0 && (
            <Pressable style={styles.dropdownBtn} onPress={() => setOpenSheet('type')}>
              <Txt style={styles.dropdownBtnTxt} numberOfLines={1}>{type || 'Venue type'}</Txt>
              <ChevronDown size={14} color={colors.muted} />
            </Pressable>
          )}
          {!!capBands && (
            <Pressable style={styles.dropdownBtn} onPress={() => setOpenSheet('capacity')}>
              <Txt style={styles.dropdownBtnTxt} numberOfLines={1}>{capIdx === 0 ? 'Capacity' : capBands[capIdx - 1].label}</Txt>
              <ChevronDown size={14} color={colors.muted} />
            </Pressable>
          )}
        </ScrollView>
      )}

      <FilterOptionSheet
        visible={openSheet === 'type'}
        title="Venue type"
        options={[{ value: '', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))]}
        selected={type}
        onSelect={setType}
        onClose={() => setOpenSheet(null)}
      />
      <FilterOptionSheet
        visible={openSheet === 'capacity'}
        title="Capacity"
        options={[{ value: '0', label: 'Any capacity' }, ...(capBands ?? []).map((b, i) => ({ value: String(i + 1), label: b.label }))]}
        selected={String(capIdx)}
        onSelect={(v) => setCapIdx(Number(v))}
        onClose={() => setOpenSheet(null)}
      />

      {!venues && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {/* Same 2-up grid as Home's "Top venues" slider. */}
      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={venues ? <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>No venues found.</Muted> : null}
        renderItem={({ item: v }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('VenueProfile', { id: v.id })}>
            <View style={[styles.photo, { backgroundColor: `hsl(${v.photoHue} 45% 24%)` }]}>
              {v.galleryUrls?.[0] ? <Image source={{ uri: v.galleryUrls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {v.logoUrl && (
                <View style={styles.logoBadge}>
                  <Image source={{ uri: v.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              )}
              <Pressable style={styles.favBtn} onPress={() => toggleFav(v.id)} hitSlop={8}>
                <Heart size={14} color={favourites.has(v.id) ? colors.accent : '#fff'} fill={favourites.has(v.id) ? colors.accent : 'transparent'} />
              </Pressable>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.nameRow}>
                <Txt style={styles.name} numberOfLines={1}>{v.name}</Txt>
                {v.verified && <BadgeCheck size={13} color={colors.accent} />}
              </View>
              <Muted style={styles.meta} numberOfLines={1}>{v.type} · {v.locality}</Muted>
              <Muted style={styles.stats}>★ {v.rating} · {v.followers} followers</Muted>
              <Muted style={styles.stats}>{v.eventsHosted} event{v.eventsHosted === 1 ? '' : 's'} hosted</Muted>
              {(() => {
                const key = `venue:${v.id}`;
                const isFollowing = following.has(key);
                return (
                  <Pressable style={[styles.followPill, isFollowing && styles.followPillGhost]} onPress={() => toggleFollow(key)}>
                    <Txt style={[styles.followPillTxt, isFollowing && styles.followPillTxtGhost]}>{isFollowing ? 'Following ✓' : '+ Follow'}</Txt>
                  </Pressable>
                );
              })()}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.l, height: 48, marginHorizontal: spacing.l, marginVertical: spacing.m,
  },
  searchInput: { flex: 1, height: '100%', padding: 0, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m, includeFontPadding: false },
  scrollRowFix: { flexGrow: 0, flexShrink: 0 },
  dropdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, paddingHorizontal: spacing.l, paddingBottom: spacing.m },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s, maxWidth: 170,
  },
  dropdownBtnTxt: { fontSize: fontSize.s, fontFamily: fontFamily.medium, flexShrink: 1 },
  list: { paddingHorizontal: spacing.l, paddingBottom: spacing.xxl },
  row: { gap: spacing.m, marginBottom: spacing.m },
  card: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1 },
  logoBadge: { position: 'absolute', left: spacing.s, bottom: -14, width: 30, height: 30, borderRadius: radius.s, overflow: 'hidden', borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface2 },
  favBtn: { position: 'absolute', top: spacing.s, right: spacing.s, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(20,21,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.m, paddingTop: spacing.m + 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.s, flexShrink: 1 },
  meta: { fontSize: 10.5, marginTop: 2 },
  stats: { fontSize: 10.5, marginTop: 4 },
  followPill: { height: 30, borderRadius: radius.s, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.s, marginTop: spacing.s },
  followPillGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  followPillTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  followPillTxtGhost: { color: colors.text },
});
