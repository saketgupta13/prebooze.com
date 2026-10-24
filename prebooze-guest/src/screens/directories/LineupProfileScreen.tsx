import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck, Share2 } from 'lucide-react-native';
import SocialIcon, { guessPlatform } from '../../components/SocialIcon';
import EventGridCard from '../../components/EventGridCard';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { ApiError } from '../../api/client';
import { haptics } from '../../lib/haptics';
import { htmlToPlainText } from '../../lib/richtext';
import { absoluteUrl } from '../../lib/urls';
import { Button, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, LineupProfile } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'LineupProfile'; params: RootStackParamList['LineupProfile'] };

export default function LineupProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const [lineup, setLineup] = useState<LineupProfile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [following, setFollowing] = useState(false);
  // Real bug: lineup.followers is a snapshot from the fetch — toggling
  // follow never touched it. Tracked separately, nudged ±1 optimistically.
  const [followerCount, setFollowerCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [l, social_] = await Promise.all([catalog.lineup(route.params.slug), social.mySocialState().catch(() => null)]);
      setLineup(l);
      setFollowerCount(l.followers);
      const key = `lineup:${l.slug}`;
      if (social_) setFollowing(social_.following.includes(key));
      // No lineupId filter on the real /events endpoint — same approach as
      // prebooze-web's LineupProfile.tsx: fetch the whole catalog including
      // past events and filter client-side by lineup name.
      const all = await catalog.events({ includePast: true });
      setEvents(all.filter((e) => e.lineup.some((x) => x.name.toLowerCase() === l.name.toLowerCase())));
    } catch {
      // leave lineup null
    }
  }, [route.params.slug]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!lineup) return;
    const key = `lineup:${lineup.slug}`;
    const was = following;
    setFollowing(!was);
    haptics.tap();
    setFollowerCount((c) => c + (was ? -1 : 1));
    try {
      await (was ? social.unfollow(key) : social.follow(key));
    } catch (e) {
      setFollowing(was);
      setFollowerCount((c) => c + (was ? 1 : -1));
      haptics.error();
      Alert.alert('Could not update follow', e instanceof ApiError ? e.message : 'Try again.');
    }
  };

  if (!lineup) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const share = () => {
    Share.share({ message: `${lineup.name} on Prebooze — ${absoluteUrl(`/lineup/${lineup.slug}`)}` }).catch(() => {});
  };

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 >= now);
  const past = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < now);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.backRow}>
          <IconButton onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.text} />
          </IconButton>
        </View>

        {/* Header: square logo + name/category/city, same pattern as
            Organizer/Venue screens — identity block first, actions row
            below it. */}
        <View style={styles.headRow}>
          <View style={[styles.logo, { backgroundColor: `hsl(${lineup.hue} 55% 40%)` }]}>
            {lineup.logoUrl ? <Image source={{ uri: lineup.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.logoEmoji}>{lineup.emoji || lineup.name[0]}</Txt>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Txt style={styles.name}>{lineup.name}</Txt>
              {lineup.verified && <BadgeCheck size={16} color={colors.accent} />}
            </View>
            <View style={styles.tag}><Txt style={styles.tagTxt}>{lineup.category}</Txt></View>
            <Muted style={styles.meta}>{lineup.city} · {lineup.eventsPlayed} events played</Muted>
          </View>
        </View>

        {/* Boxed 3-up stat grid, same .stat3 pattern as web/Organizer/Venue. */}
        <View style={styles.stat3}>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{followerCount}</Txt>
            <Muted style={styles.statLabel}>followers</Muted>
          </View>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{lineup.eventsPlayed}</Txt>
            <Muted style={styles.statLabel}>events</Muted>
          </View>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{upcoming.length}</Txt>
            <Muted style={styles.statLabel}>upcoming</Muted>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button label={following ? 'Following ✓' : '+ Follow'} variant={following ? 'ghost' : 'primary'} onPress={toggleFollow} style={styles.followBtn} />
          <Pressable style={styles.iconRound} onPress={share}>
            <Share2 size={14} color={colors.muted} />
          </Pressable>
        </View>

        {lineup.links.length > 0 && (
          <View style={styles.socialRow}>
            {lineup.links.map((link) => (
              <Pressable key={link} style={styles.socialBtn} onPress={() => Linking.openURL(link).catch(() => {})}>
                <SocialIcon platform={guessPlatform(link)} size={18} color={colors.text} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Single bordered card holding About + kv rows, same as
            Organizer/Venue's About card. */}
        <View style={styles.card}>
          <Txt style={styles.cardHead}>About</Txt>
          <Muted style={styles.about}>{lineup.bio ? htmlToPlainText(lineup.bio) : 'No bio yet.'}</Muted>
          <View style={styles.kvList}>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Category</Muted>
              <Txt style={styles.kvVal}>{lineup.category}</Txt>
            </View>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Based in</Muted>
              <Txt style={styles.kvVal}>{lineup.city}</Txt>
            </View>
            <View style={[styles.kv, styles.kvLast]}>
              <Muted style={styles.kvKey}>Verified</Muted>
              {lineup.verified ? (
                <View style={styles.verifiedRow}><BadgeCheck size={13} color={colors.accent} /><Txt style={styles.verifiedTxt}>by Prebooze</Txt></View>
              ) : (
                <Muted style={styles.kvVal}>—</Muted>
              )}
            </View>
          </View>
        </View>

        <Txt style={styles.sectionLabel}>Upcoming shows ({upcoming.length})</Txt>
        {upcoming.length > 0 ? (
          <View style={styles.grid}>
            {upcoming.map((ev) => (
              <EventGridCard key={ev.id} event={ev} isPast={false} onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
            ))}
          </View>
        ) : (
          <Muted style={styles.empty}>No upcoming shows announced — follow to hear first.</Muted>
        )}

        <Txt style={styles.sectionLabel}>Past events ({past.length})</Txt>
        {past.length > 0 ? (
          <View style={styles.grid}>
            {past.slice(0, 6).map((ev) => (
              <EventGridCard key={ev.id} event={ev} isPast onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
            ))}
          </View>
        ) : (
          <Muted style={styles.empty}>No past events yet.</Muted>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  backRow: { marginBottom: spacing.m },
  headRow: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
  logo: { width: 76, height: 76, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoEmoji: { color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: spacing.s, paddingVertical: 3, marginTop: 4 },
  tagTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  meta: { marginTop: 4, fontSize: fontSize.s },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  iconRound: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  followBtn: { flex: 1 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.l, justifyContent: 'center' },
  socialBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stat3: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.m, alignItems: 'center' },
  statVal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.l },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.l },
  cardHead: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  about: { lineHeight: 20 },
  kvList: { marginTop: spacing.s },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' },
  kvLast: { borderBottomWidth: 0 },
  kvKey: { fontSize: fontSize.s },
  kvVal: { fontSize: fontSize.s },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedTxt: { fontSize: fontSize.s, color: colors.accent },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s, marginTop: spacing.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, justifyContent: 'space-between' },
  empty: { marginBottom: spacing.m },
});
