import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Search } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { useCity } from '../../context/CityContext';
import DirectoryCard from '../../components/DirectoryCard';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Organizer } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OrganizersDirectoryScreen() {
  const navigation = useNavigation<Nav>();
  const { city } = useCity();
  const [orgs, setOrgs] = useState<Organizer[] | null>(null);
  const [search, setSearch] = useState('');
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    catalog.organizers(city).then(setOrgs).catch(() => setOrgs([]));
    social.mySocialState().then((s) => setFollowing(new Set(s.following))).catch(() => {});
  }, [city]));

  const toggleFollow = (key: string) => {
    const was = following.has(key);
    setFollowing((s) => { const next = new Set(s); was ? next.delete(key) : next.add(key); return next; });
    (was ? social.unfollow(key) : social.follow(key)).catch(() => {
      setFollowing((s) => { const next = new Set(s); was ? next.add(key) : next.delete(key); return next; });
    });
  };

  const followBtn = (key: string) => {
    const isFollowing = following.has(key);
    return (
      <Pressable style={[styles.followPill, isFollowing && styles.followPillGhost]} onPress={() => toggleFollow(key)}>
        <Txt style={[styles.followPillTxt, isFollowing && styles.followPillTxtGhost]}>{isFollowing ? 'Following ✓' : '+ Follow'}</Txt>
      </Pressable>
    );
  };

  const filtered = (orgs ?? []).filter((o) => o.brandName.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Organizers in {city}</Txt>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={colors.muted} style={{ marginRight: spacing.s }} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search organizers..." placeholderTextColor={colors.muted} style={styles.searchInput} textAlignVertical="center" />
      </View>

      {!orgs && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {/* Same 2-up grid DirectoryCard as Home's "Top organizers" slider —
          previously a single-column list of plain rows, inconsistent with
          the card style used everywhere else. */}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={orgs ? <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>No organizers found.</Muted> : null}
        renderItem={({ item: o }) => (
          <DirectoryCard
            style={styles.card}
            onPress={() => navigation.navigate('OrganizerProfile', { id: o.id })}
            hue={o.logoHue}
            avatarText="🎧"
            avatarImage={o.logoUrl}
            name={o.brandName}
            verified={o.verified}
            meta={`${o.city} · ★ ${o.rating}`}
            stats={`${o.eventsHosted} events · ${o.followers} followers`}
            action={followBtn(o.id)}
          />
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
  list: { paddingHorizontal: spacing.l, paddingBottom: spacing.xxl },
  row: { gap: spacing.m, marginBottom: spacing.m },
  card: { flex: 1, width: undefined },
  followPill: { height: 30, borderRadius: radius.s, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.s },
  followPillGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  followPillTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  followPillTxtGhost: { color: colors.text },
});
