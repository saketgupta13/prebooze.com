import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Search, Ticket, Users } from 'lucide-react-native';
import { bookingsApi } from '../../api/bookings';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { useAuth } from '../../context/AuthContext';
import DirectoryCard from '../../components/DirectoryCard';
import { Chip, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Person } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Mirrors web's People.tsx: intro card, Discover/Following tabs (with a
 * live count), a real search field, and "N in common" + going-event tags
 * computed by intersecting each person's real going[] against the
 * viewer's own real bookings/interested — not just a flat follow list. */
export default function PeopleScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  // Real bug: cards read p.followers straight off the fetch-time snapshot,
  // so following/unfollowing someone from this grid left their shown count
  // stale until the whole list reloaded — same bug PersonProfileScreen and
  // the Organizer/Venue/Lineup/Promoter profiles already had fixed, just
  // never ported to this grid. Keyed by person id, nudged ±1 on tap.
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [myEventIds, setMyEventIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, social_, bookings] = await Promise.all([
        catalog.people(user?.city || 'Nagpur'),
        social.mySocialState().catch(() => ({ following: [] as string[], interested: [] as string[] })),
        bookingsApi.list().catch(() => []),
      ]);
      setPeople(list);
      setFollowerCounts((prev) => {
        const next = { ...prev };
        for (const p of list) if (!(p.id in next)) next[p.id] = p.followers;
        return next;
      });
      setFollowing(new Set(social_.following));
      setMyEventIds(new Set([
        ...bookings.filter((b) => b.status !== 'cancelled').map((b) => b.eventId),
        ...social_.interested,
      ]));
    } catch {
      setPeople([]);
    }
  }, [user?.city]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async (p: Person) => {
    const key = `person:${p.id}`;
    const isFollowing = following.has(key);
    setFollowing((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(key) : next.add(key);
      return next;
    });
    setFollowerCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? p.followers) + (isFollowing ? -1 : 1) }));
    try {
      await (isFollowing ? social.unfollow(key) : social.follow(key));
    } catch {
      setFollowing((prev) => {
        const next = new Set(prev);
        isFollowing ? next.add(key) : next.delete(key);
        return next;
      });
      setFollowerCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? p.followers) + (isFollowing ? 1 : -1) }));
    }
  };

  const followBtn = (p: Person) => {
    const isFollowing = following.has(`person:${p.id}`);
    return (
      <Pressable style={[styles.followPill, isFollowing && styles.followPillGhost]} onPress={() => toggleFollow(p)}>
        <Txt style={[styles.followPillTxt, isFollowing && styles.followPillTxtGhost]}>{isFollowing ? 'Following ✓' : '+ Follow'}</Txt>
      </Pressable>
    );
  };

  const commonCount = (p: Person) => p.going.filter((e) => myEventIds.has(e.id)).length;
  // Real bug: this counted straight off the raw `people` list, before the
  // self-exclusion filter below ran — a leftover self-follow row from
  // before that guard existed (person:<own id>, possible pre-fix state)
  // silently inflated the "Following · N" badge by one. Same self-filter
  // as `list` below, applied here too.
  const followingCount = (people ?? []).filter((p) => p.username !== user?.username && following.has(`person:${p.id}`)).length;

  const list = useMemo(() => {
    // Real bug: the backend's /people list never excludes the viewer's own
    // row (it only uses viewerId for follow-state), so the directory and
    // its Follow button rendered the signed-in guest's own card too.
    let l = (people ?? []).filter((p) => p.username !== user?.username);
    if (tab === 'following') l = l.filter((p) => following.has(`person:${p.id}`));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((p) => (p.name + p.username).toLowerCase().includes(s));
    }
    return [...l].sort((a, b) => commonCount(b) - commonCount(a) || b.followers - a.followers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, people, q, following, myEventIds, user?.username]);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.introCard}>
          <View style={styles.introTitleRow}>
            <Txt style={styles.h1}>Find your people</Txt>
            <Users size={20} color={colors.text} />
          </View>
          <Muted style={styles.introTxt}>Follow the crews and regulars whose nights you want in on — then you'll see who's going before you book.</Muted>
        </View>

        <View style={styles.tabRow}>
          <Chip label="Discover" active={tab === 'discover'} onPress={() => setTab('discover')} />
          <Chip label={followingCount > 0 ? `Following · ${followingCount}` : 'Following'} active={tab === 'following'} onPress={() => setTab('following')} />
        </View>

        <View style={styles.searchBar}>
          <Search size={16} color={colors.muted} style={{ marginRight: spacing.s }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Search people in ${user?.city || 'your city'}...`}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            textAlignVertical="center"
          />
        </View>
      </View>

      {!people && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={people ? (
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
            {tab === 'following' ? "You're not following anyone here yet." : 'No people here yet.'}
          </Muted>
        ) : null}
        renderItem={({ item: p }) => {
          const common = commonCount(p);
          const going = p.going;
          return (
            <DirectoryCard
              style={styles.card}
              onPress={() => navigation.navigate('PersonProfile', { username: p.username })}
              hue={p.avatarHue}
              avatarText={p.name[0]}
              avatarImage={p.avatarUrl}
              name={p.name}
              verified={p.verified}
              meta={`@${p.username} · ${p.city}`}
              bio={p.bio}
              stats={`${followerCounts[p.id] ?? p.followers} followers · ${going.length} going`}
              action={
                <View>
                  {(common > 0 || going.length > 0) && (
                    <View style={styles.tagRow}>
                      {common > 0 && (
                        <View style={styles.commonTag}>
                          <Flame size={11} color={colors.accent} />
                          <Txt style={styles.commonTagTxt}>{common} in common</Txt>
                        </View>
                      )}
                      {going.slice(0, common > 0 ? 1 : 2).map((e) => (
                        <Pressable key={e.id} style={styles.eventTag} onPress={() => navigation.navigate('EventDetail', { slug: e.slug })}>
                          <Ticket size={11} color={colors.muted} />
                          <Muted style={styles.eventTagTxt} numberOfLines={1}>{e.title}</Muted>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {followBtn(p)}
                </View>
              }
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.l, paddingTop: spacing.s },
  introCard: { backgroundColor: 'rgba(155,225,61,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.m },
  introTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  introTxt: { marginTop: 4, fontSize: fontSize.s, lineHeight: 19 },
  tabRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.l, height: 48, marginBottom: spacing.m,
  },
  searchInput: { flex: 1, height: '100%', padding: 0, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m, includeFontPadding: false },
  list: { paddingHorizontal: spacing.l, paddingBottom: spacing.xxl },
  row: { gap: spacing.m, marginBottom: spacing.m },
  card: { flex: 1, width: undefined },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.s },
  commonTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.s, paddingHorizontal: 6, paddingVertical: 3 },
  commonTagTxt: { fontSize: 9.5, fontFamily: fontFamily.bold, color: colors.accent },
  eventTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: 6, paddingVertical: 3, maxWidth: 110 },
  eventTagTxt: { fontSize: 9.5 },
  followPill: { height: 30, borderRadius: radius.s, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.s },
  followPillGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  followPillTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  followPillTxtGhost: { color: colors.text },
});
