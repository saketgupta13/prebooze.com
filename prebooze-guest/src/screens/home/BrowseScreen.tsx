import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronDown, Headphones, Landmark, Mic, Search, Ticket } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { haptics } from '../../lib/haptics';
import { useCity } from '../../context/CityContext';
import EventGridCard from '../../components/EventGridCard';
import FilterOptionSheet from '../../components/FilterOptionSheet';
import CategoryFilterSheet from '../../components/CategoryFilterSheet';
import { Chip, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'Browse'; params: RootStackParamList['Browse'] };
type SearchHit = { label: string; type: string; to: string };
type DateFilter = 'All' | 'Today' | 'Tomorrow' | 'This week' | 'This month';
type SortOption = 'date' | 'price_asc' | 'price_desc';

const DATE_FILTERS: DateFilter[] = ['All', 'Today', 'Tomorrow', 'This week', 'This month'];
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date', label: 'Sorted by date' },
  { value: 'price_asc', label: 'Price low→high' },
  { value: 'price_desc', label: 'Price high→low' },
];

const TYPE_ICON: Record<string, typeof Ticket> = {
  Event: Ticket,
  Venue: Landmark,
  Organizer: Headphones,
  Artist: Mic,
};

/** Same dynamic price-band logic as web's Browse.tsx priceBands — real bug
 * fixed 2026-10-19: the old filter was 3 hardcoded buckets (Under ₹30 /
 * ₹30–₹80 / ₹80+) that made no sense once prices moved outside that range.
 * Band edges are derived from the real min/max price actually on screen
 * right now, split into 3 equal-width bands, rounded to a clean ₹10. */
function priceBands(prices: number[]): { label: string; test: (p: number) => boolean }[] | null {
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return null;
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const low = round10(min + (max - min) / 3);
  const high = round10(min + (2 * (max - min)) / 3);
  if (low === min || high === low) return null;
  return [
    { label: `Under ₹${low}`, test: (p) => p < low },
    { label: `₹${low}–₹${high}`, test: (p) => p >= low && p <= high },
    { label: `₹${high}+`, test: (p) => p > high },
  ];
}

export default function BrowseScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { city: browsingCity } = useCity();
  const city = route.params?.city || browsingCity;
  const [search, setSearch] = useState(route.params?.search ?? '');
  // Same full filter set as web's Browse.tsx: category (+ sub-category once
  // one's picked), price band, sort — not just date. `cat` still arrives as
  // a route param (category tiles on Home/Categories navigate here with
  // one) but is now a real in-screen filter, not a fixed starting scope.
  const [cat, setCat] = useState(route.params?.cat ?? '');
  const [sub, setSub] = useState('');
  const [sort, setSort] = useState<SortOption>('date');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All');
  const [priceIdx, setPriceIdx] = useState(0); // 0 = no filter, else 1-indexed into the computed bands
  const [events, setEvents] = useState<Event[] | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<{ name: string; icon: string; subs: string[] }[]>([]);
  // Dropdown sheets, not horizontal chip rows — three filters stacked as
  // scrollable chip rows under the date row ate most of the screen before
  // a single event ever showed. Matches web's Browse.tsx <select> dropdowns
  // (tap to open, pick one, it closes) instead of competing for width.
  const [openSheet, setOpenSheet] = useState<'category' | 'price' | 'sort' | null>(null);
  // Real unified search (GET /search) — events, venues, organizers and
  // line-ups/artists, same as prebooze-web's search dropdown. The events
  // grid below still comes from the events-only endpoint (it needs the
  // category/price/poster fields search's lightweight rows don't carry).
  const [roleHits, setRoleHits] = useState<SearchHit[]>([]);
  // Trending search tags (GET /search/trending) — same as web Header.tsx's
  // SearchBox dropdown, shown only while the search box is empty so it
  // doesn't compete with live suggestions once the guest starts typing.
  const [trending, setTrending] = useState<string[]>([]);
  useEffect(() => {
    catalog.trending().then(setTrending).catch(() => setTrending([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setEvents(await catalog.events({
        city, cat: cat || undefined, sub: sub || undefined, search: search.trim() || undefined,
        sort: sort === 'date' ? undefined : sort,
      }));
    } catch {
      setEvents([]);
    }
    social.mySocialState().then((s) => setWishlist(new Set(s.wishlist))).catch(() => {});
  }, [city, cat, sub, search, sort]);

  useEffect(() => {
    catalog.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounced — fires ~350ms after typing stops, same as a live search
  // dropdown, not on every keystroke.
  useEffect(() => {
    const q = search.trim();
    if (!q) { setRoleHits([]); return; }
    const t = setTimeout(() => {
      catalog.search(q)
        .then((hits) => setRoleHits(hits.filter((h) => h.type !== 'Event')))
        .catch(() => setRoleHits([]));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const toggleWishlist = (eventId: string) => {
    const was = wishlist.has(eventId);
    setWishlist((s) => { const next = new Set(s); was ? next.delete(eventId) : next.add(eventId); return next; });
    haptics.tap();
    social.wishlist(eventId, !was).catch(() => {
      setWishlist((s) => { const next = new Set(s); was ? next.add(eventId) : next.delete(eventId); return next; });
    });
  };

  const openHit = (hit: SearchHit) => {
    const id = hit.to.split('/').filter(Boolean).pop();
    if (!id) return;
    if (hit.type === 'Venue') navigation.navigate('VenueProfile', { id });
    else if (hit.type === 'Organizer') navigation.navigate('OrganizerProfile', { id });
    else if (hit.type === 'Artist') navigation.navigate('LineupProfile', { slug: id });
  };

  // Same date-range scoping as Home's "Top selling events" — applied
  // client-side on top of whatever the server already returned for
  // city/category/search.
  const dateScoped = (() => {
    if (!events || dateFilter === 'All') return events ?? [];
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOfDay(now);
    if (dateFilter === 'Today') {
      const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      return events.filter((e) => { const d = new Date(e.date); return d >= todayStart && d < tomorrowStart; });
    }
    if (dateFilter === 'Tomorrow') {
      const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const dayAfter = new Date(tomorrowStart); dayAfter.setDate(dayAfter.getDate() + 1);
      return events.filter((e) => { const d = new Date(e.date); return d >= tomorrowStart && d < dayAfter; });
    }
    if (dateFilter === 'This week') {
      const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
      return events.filter((e) => { const d = new Date(e.date); return d >= todayStart && d < weekEnd; });
    }
    const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);
    return events.filter((e) => { const d = new Date(e.date); return d >= todayStart && d < monthEnd; });
  })();

  const eventMinPrice = (e: Event) => e.minPrice ?? (e.tiers.length ? Math.min(...e.tiers.map((t) => t.price)) : 0);
  // Computed from dateScoped (post date/category/search, pre price) — same
  // set the chip row below is built from, so a band's label always matches
  // what it actually filters to when tapped.
  const priceBandOptions = priceBands(dateScoped.map(eventMinPrice));
  const priceScoped = priceBandOptions && priceIdx > 0
    ? dateScoped.filter((e) => priceBandOptions[priceIdx - 1]?.test(eventMinPrice(e)))
    : dateScoped;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            placeholder="Search events, venues, organizers, artists..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            textAlignVertical="center"
          />
        </View>
      </View>

      {/* Real bug: a horizontal ScrollView with no `style` prop (only
          contentContainerStyle) can measure its own cross-axis as "fill
          remaining space" in a flex column on Android/Yoga, not just its
          content height — this one only ever showed 5 fixed labels, so it
          never had room to visibly stretch, but the dropdown row right
          below it (content height genuinely changes as filters are
          picked) did. `flexGrow: 0` on the ScrollView itself (not just its
          content) pins both to their natural content height regardless. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRowFix} contentContainerStyle={styles.dateRow}>
        {DATE_FILTERS.map((d) => (
          <Chip key={d} label={d} active={dateFilter === d} onPress={() => setDateFilter(d)} />
        ))}
      </ScrollView>

      {/* Real bug: this used to flexWrap — a longer selected label (a price
          band, "Price high→low") pushed the row's total content past one
          line, wrapping to a second and growing the screen taller every
          time a filter was picked. Horizontal scroll instead, same fixed-
          height pattern as the date row above, so picking a filter never
          changes the layout's height. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRowFix} contentContainerStyle={styles.dropdownRow}>
        {categories.length > 0 && (
          <Pressable style={styles.dropdownBtn} onPress={() => setOpenSheet('category')}>
            <Txt style={styles.dropdownBtnTxt} numberOfLines={1}>{sub || cat || 'Category'}</Txt>
            <ChevronDown size={14} color={colors.muted} />
          </Pressable>
        )}
        {!!priceBandOptions && (
          <Pressable style={styles.dropdownBtn} onPress={() => setOpenSheet('price')}>
            <Txt style={styles.dropdownBtnTxt} numberOfLines={1}>{priceIdx === 0 ? 'Price' : priceBandOptions[priceIdx - 1].label}</Txt>
            <ChevronDown size={14} color={colors.muted} />
          </Pressable>
        )}
        <Pressable style={styles.dropdownBtn} onPress={() => setOpenSheet('sort')}>
          <Txt style={styles.dropdownBtnTxt} numberOfLines={1}>{SORT_OPTIONS.find((s) => s.value === sort)!.label}</Txt>
          <ChevronDown size={14} color={colors.muted} />
        </Pressable>
      </ScrollView>

      <CategoryFilterSheet
        visible={openSheet === 'category'}
        categories={categories}
        cat={cat}
        sub={sub}
        onSelect={(c, s) => { setCat(c); setSub(s); setPriceIdx(0); }}
        onClose={() => setOpenSheet(null)}
      />
      <FilterOptionSheet
        visible={openSheet === 'price'}
        title="Price"
        options={[{ value: '0', label: 'Any price' }, ...(priceBandOptions ?? []).map((b, i) => ({ value: String(i + 1), label: b.label }))]}
        selected={String(priceIdx)}
        onSelect={(v) => setPriceIdx(Number(v))}
        onClose={() => setOpenSheet(null)}
      />
      <FilterOptionSheet
        visible={openSheet === 'sort'}
        title="Sort"
        options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        selected={sort}
        onSelect={setSort}
        onClose={() => setOpenSheet(null)}
      />

      {!search.trim() && trending.length > 0 && (
        <View style={styles.trendingRow}>
          <Muted style={styles.trendingLabel}>Trending</Muted>
          <View style={styles.trendingTags}>
            {trending.map((t) => (
              <Chip key={t} label={t} active={false} onPress={() => setSearch(t)} />
            ))}
          </View>
        </View>
      )}

      {roleHits.length > 0 && (
        <View style={styles.roleHits}>
          {roleHits.map((hit, i) => {
            const Icon = TYPE_ICON[hit.type] ?? Search;
            return (
              <Pressable key={`${hit.type}-${i}`} style={styles.roleHitRow} onPress={() => openHit(hit)}>
                <Icon size={15} color={colors.muted} />
                <Txt style={styles.roleHitLabel} numberOfLines={1}>{hit.label}</Txt>
                <Muted style={styles.roleHitType}>{hit.type}</Muted>
              </Pressable>
            );
          })}
        </View>
      )}

      {!events && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      <FlatList
        data={priceScoped}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.m }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={events ? <Muted style={{ marginTop: spacing.xl, textAlign: 'center' }}>No events found.</Muted> : null}
        renderItem={({ item: ev }) => (
          <EventGridCard
            event={ev}
            isPast={false}
            onPress={() => navigation.navigate('EventDetail', { slug: ev.slug })}
            favorited={wishlist.has(ev.id)}
            onToggleFavorite={() => toggleWishlist(ev.id)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.l, height: 48,
  },
  searchIcon: { marginRight: spacing.s },
  searchInput: { flex: 1, height: '100%', padding: 0, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m, includeFontPadding: false },
  // Exact same tokens as Home's own date-filter row (HomeScreen.tsx
  // chipRow) — was using a different padding/margin combo that rendered
  // slightly different spacing from Home's identical pill row.
  // Pins the ScrollView component itself to its content height — see the
  // doc comment at its call sites for why this is needed in addition to
  // contentContainerStyle's own alignItems.
  scrollRowFix: { flexGrow: 0, flexShrink: 0 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, marginBottom: spacing.l, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  // Real bug: no alignItems here meant the row's default 'stretch' let each
  // pill Pressable stretch to the ScrollView's full cross-axis (vertical)
  // height instead of hugging its own content — picking a filter that made
  // a sibling pill disappear (e.g. Price, once only one price remains)
  // changed how much leftover vertical space the row had to stretch into,
  // visibly ballooning the remaining pills' height. 'flex-start' pins every
  // pill to its own natural height regardless of row/content changes.
  dropdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, paddingHorizontal: spacing.l, paddingBottom: spacing.m },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s, maxWidth: 170,
  },
  dropdownBtnTxt: { fontSize: fontSize.s, fontFamily: fontFamily.medium, flexShrink: 1 },
  trendingRow: { marginHorizontal: spacing.l, marginBottom: spacing.m },
  trendingLabel: { fontSize: fontSize.xs, marginBottom: spacing.s },
  trendingTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  roleHits: { marginHorizontal: spacing.l, marginBottom: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, overflow: 'hidden' },
  roleHitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.m, paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border },
  roleHitLabel: { flex: 1, fontSize: fontSize.s },
  roleHitType: { fontSize: 10.5 },
  list: { paddingHorizontal: spacing.l, paddingBottom: spacing.xxl, gap: spacing.m },
});
