import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck, Share2 } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { htmlToPlainText } from '../../lib/richtext';
import { absoluteUrl } from '../../lib/urls';
import { Button, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, Person, PersonDetail } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'PersonProfile'; params: RootStackParamList['PersonProfile'] };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Mirrors web's PersonProfile.tsx: mutual-follows + "followed by X you
 * follow" social proof (computed client-side by intersecting this person's
 * followers/following against the viewer's own, same as web does — no
 * separate server-side viewer-relative endpoint needed), expandable
 * followers/following lists via tapping a stat, and the Interested section
 * alongside Going/Past. */
export default function PersonProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { user } = useAuth();
  // Real bug: nothing stopped the viewer's own profile from rendering a
  // working Follow button that called follow(self) — the backend doesn't
  // reject it either, so it silently inflated the guest's own follower
  // count. Guarded client-side by username match (User has no numeric id
  // exposed, PersonDetail/Person both key off username too).
  const isSelf = !!user && user.username === route.params.username;
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [following, setFollowing] = useState(false);
  // Real bug: person.followers is a snapshot array from the fetch —
  // toggling follow never touched it, so the count on screen stayed
  // frozen until the guest left and came back. Tracked separately,
  // nudged ±1 the instant the button is tapped (and reverted on failure),
  // same optimistic pattern every other profile screen already uses.
  const [followerCount, setFollowerCount] = useState(0);
  const [myFollowing, setMyFollowing] = useState<string[]>([]);
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    (async () => {
      const p = await catalog.person(route.params.username).catch(() => null);
      setPerson(p);
      setOpenList(null);
      if (p) {
        setFollowerCount(p.followers.length);
        const s = await social.mySocialState().catch(() => null);
        if (s) {
          setFollowing(s.following.includes(`person:${p.id}`));
          setMyFollowing(s.following);
        }
      }
    })();
  }, [route.params.username]);

  const toggleFollow = async () => {
    if (!person) return;
    const key = `person:${person.id}`;
    const was = following;
    setFollowing(!was);
    setFollowerCount((c) => c + (was ? -1 : 1));
    try {
      await (was ? social.unfollow(key) : social.follow(key));
    } catch (e) {
      setFollowing(was);
      setFollowerCount((c) => c + (was ? 1 : -1));
      Alert.alert('Could not update follow', e instanceof ApiError ? e.message : 'Try again.');
    }
  };

  const share = () => {
    if (!person) return;
    Share.share({ message: `${person.name} on Prebooze — ${absoluteUrl(`/u/${person.username}`)}` }).catch(() => {});
  };

  if (!person) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const myFollowingPersonIds = new Set(myFollowing.filter((k) => k.startsWith('person:')).map((k) => k.slice('person:'.length)));
  const mutual = person.following.filter((p) => myFollowingPersonIds.has(p.id));
  const proof = person.followers.filter((p) => myFollowingPersonIds.has(p.id));
  const proofNames = proof.slice(0, 2).map((p) => p.name.split(' ')[0]).join(', ');
  const toggleList = (which: 'followers' | 'following') => setOpenList((cur) => (cur === which ? null : which));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.backRow}>
          <IconButton onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.text} />
          </IconButton>
        </View>

        {/* Header row matches OrganizerProfile/VenueProfile's layout: a
            square-rounded avatar beside a name/meta column, rather than the
            old centered-circle layout this screen used before — keeps every
            profile type visually consistent. */}
        <View style={styles.headRow}>
          <View style={[styles.avatar, { backgroundColor: `hsl(${person.avatarHue} 55% 40%)` }]}>
            {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.avatarLetter}>{person.name[0]}</Txt>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Txt style={styles.name}>{person.name}</Txt>
              {person.verified && <BadgeCheck size={16} color={colors.accent} />}
            </View>
            <Muted style={styles.meta}>@{person.username} · {person.city}</Muted>
          </View>
        </View>

        <View style={styles.stat3}>
          <Pressable style={styles.statBox} onPress={() => toggleList('followers')}>
            <Txt style={styles.statVal}>{followerCount}</Txt>
            <Muted style={[styles.statLabel, openList === 'followers' && styles.statLabelOn]}>followers ▾</Muted>
          </Pressable>
          <Pressable style={styles.statBox} onPress={() => toggleList('following')}>
            <Txt style={styles.statVal}>{person.following.length}</Txt>
            <Muted style={[styles.statLabel, openList === 'following' && styles.statLabelOn]}>following ▾</Muted>
          </Pressable>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{person.going.length}</Txt>
            <Muted style={styles.statLabel}>going</Muted>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isSelf ? (
            <View style={[styles.followBtn, styles.selfBadge]}><Txt style={styles.selfBadgeTxt}>This is you</Txt></View>
          ) : (
            <Button label={following ? 'Following ✓' : '+ Follow'} variant={following ? 'ghost' : 'primary'} onPress={toggleFollow} style={styles.followBtn} />
          )}
          <Pressable style={styles.iconRound} onPress={share}>
            <Share2 size={14} color={colors.muted} />
          </Pressable>
        </View>

        {/* About card — same bordered .card + .kv pattern as the other
            profile screens, holding the bio and the "followed by X you
            follow" social-proof line as a kv row instead of free-floating
            centered text. */}
        {(!!person.bio || proof.length > 0) && (
          <View style={styles.card}>
            {!!person.bio && <Muted style={styles.about}>{htmlToPlainText(person.bio)}</Muted>}
            {proof.length > 0 && (
              <View style={styles.kvList}>
                <View style={[styles.kv, styles.kvLast]}>
                  <Muted style={styles.kvKey}>Followed by</Muted>
                  <Txt style={styles.kvVal}>
                    <Txt style={{ fontFamily: fontFamily.bold }}>{proofNames}</Txt>{proof.length > 2 ? ` +${proof.length - 2}` : ''} you follow
                  </Txt>
                </View>
              </View>
            )}
          </View>
        )}

        {openList === 'followers' && (
          <PeopleList title="Followers" people={person.followers} empty="No followers yet." onPress={(u) => navigation.push('PersonProfile', { username: u })} />
        )}
        {openList === 'following' && (
          <PeopleList title="Following" people={person.following} empty="Not following anyone yet." onPress={(u) => navigation.push('PersonProfile', { username: u })} />
        )}

        <EventSection title="Going" count={person.going.length} events={person.going} empty="Nothing booked yet." onPress={(slug, city) => navigation.navigate('EventDetail', { slug })} fallbackCity={person.city} />
        <EventSection title="Past events" count={person.past.length} events={person.past} empty="No past events yet." onPress={(slug) => navigation.navigate('EventDetail', { slug })} fallbackCity={person.city} />
        <EventSection title="Interested" count={person.interested.length} events={person.interested} empty="No saved events." onPress={(slug) => navigation.navigate('EventDetail', { slug })} fallbackCity={person.city} />

        <View style={styles.listCard}>
          <Txt style={styles.sectionLabel}>Mutual — you both follow</Txt>
          {mutual.length === 0 ? (
            <Muted style={styles.emptyTxt}>No one in common yet. Follow more people to find mutuals.</Muted>
          ) : (
            mutual.slice(0, 5).map((p, i, arr) => (
              <Pressable key={p.id} style={[styles.personRow, i === arr.length - 1 && styles.rowLast]} onPress={() => navigation.push('PersonProfile', { username: p.username })}>
                <View style={[styles.personAvatar, { backgroundColor: `hsl(${p.avatarHue} 55% 40%)` }]}>
                  {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.personAvatarLetter}>{p.name[0]}</Txt>}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={styles.personName}>{p.name}</Txt>
                  <Muted style={styles.personMeta}>@{p.username}</Muted>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function PeopleList({ title, people, empty, onPress }: { title: string; people: Person[]; empty: string; onPress: (username: string) => void }) {
  return (
    <View style={styles.listCard}>
      <Txt style={styles.sectionLabel}>{title}</Txt>
      {people.length === 0 ? (
        <Muted style={styles.emptyTxt}>{empty}</Muted>
      ) : (
        people.map((p, i) => (
          <Pressable key={p.id} style={[styles.personRow, i === people.length - 1 && styles.rowLast]} onPress={() => onPress(p.username)}>
            <View style={[styles.personAvatar, { backgroundColor: `hsl(${p.avatarHue} 55% 40%)` }]}>
              {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.personAvatarLetter}>{p.name[0]}</Txt>}
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={styles.personName}>{p.name}</Txt>
              <Muted style={styles.personMeta}>@{p.username}</Muted>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function EventSection({ title, count, events, empty, onPress }: { title: string; count: number; events: Event[]; empty: string; onPress: (slug: string, city?: string) => void; fallbackCity: string }) {
  return (
    <View style={styles.listCard}>
      <Txt style={styles.sectionLabel}>{title} <Txt style={{ color: colors.accent }}>{count}</Txt></Txt>
      {events.length === 0 ? (
        <Muted style={styles.emptyTxt}>{empty}</Muted>
      ) : (
        events.map((ev, i) => (
          <Pressable key={ev.id} style={[styles.evRow, i === events.length - 1 && styles.rowLast]} onPress={() => onPress(ev.slug)}>
            <Txt style={styles.evTitle}>{ev.title}</Txt>
            <Muted style={styles.evMeta}>{fmtDate(ev.date)} · {fmtTime(ev.date)}</Muted>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  backRow: { marginBottom: spacing.m },
  headRow: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
  avatar: { width: 76, height: 76, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLetter: { color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  meta: { marginTop: 2, fontSize: fontSize.s },
  stat3: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.m, alignItems: 'center' },
  statVal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.l },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  statLabelOn: { color: colors.accent },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  iconRound: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  followBtn: { flex: 1 },
  selfBadge: { height: 44, borderRadius: radius.m, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  selfBadgeTxt: { fontFamily: fontFamily.bold, fontSize: fontSize.s, color: colors.muted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.l },
  about: { lineHeight: 20 },
  kvList: { marginTop: spacing.s },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' },
  kvLast: { borderBottomWidth: 0 },
  kvKey: { fontSize: fontSize.s },
  kvVal: { fontSize: fontSize.s, flexShrink: 1, textAlign: 'right' },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  evRow: { paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' },
  evTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  evMeta: { fontSize: fontSize.xs, marginTop: 2 },
  listCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.l },
  emptyTxt: { fontSize: fontSize.s },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  personAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  personAvatarLetter: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.s },
  personName: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  personMeta: { fontSize: fontSize.xs },
});
