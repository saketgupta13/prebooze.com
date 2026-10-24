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
import type { Event, PromoterProfile } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'PromoterProfile'; params: RootStackParamList['PromoterProfile'] };

export default function PromoterProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const [promoter, setPromoter] = useState<PromoterProfile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [following, setFollowing] = useState(false);
  // Real bug: promoter.followers is a snapshot from the fetch — toggling
  // follow never touched it. Tracked separately, nudged ±1 optimistically.
  const [followerCount, setFollowerCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, social_] = await Promise.all([catalog.promoter(route.params.slug), social.mySocialState().catch(() => null)]);
      setPromoter(p);
      setFollowerCount(p.followers);
      const key = `promoter:${p.slug}`;
      if (social_) setFollowing(social_.following.includes(key));
      // No promoterSlug filter on the real /events endpoint — same approach
      // as prebooze-web's PromoterProfile.tsx: fetch the whole catalog
      // including past events and filter client-side by allow-list slug.
      const all = await catalog.events({ includePast: true });
      setEvents(all.filter((e) => e.promoterConfig?.allowedPromoters?.includes(p.slug)));
    } catch {
      // leave promoter null
    }
  }, [route.params.slug]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!promoter) return;
    const key = `promoter:${promoter.slug}`;
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

  if (!promoter) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const share = () => {
    Share.share({ message: `${promoter.name} on Prebooze — ${absoluteUrl(`/promoters/${promoter.slug}`)}` }).catch(() => {});
  };

  const now = Date.now();
  const promoting = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 >= now);
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
            Organizer/Venue/Lineup screens. */}
        <View style={styles.headRow}>
          <View style={[styles.logo, { backgroundColor: `hsl(${promoter.hue} 55% 40%)` }]}>
            {promoter.logoUrl ? <Image source={{ uri: promoter.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.logoLetter}>{promoter.name[0]}</Txt>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Txt style={styles.name}>{promoter.name}</Txt>
              {promoter.verified && <BadgeCheck size={16} color={colors.accent} />}
            </View>
            <View style={styles.tag}><Txt style={styles.tagTxt}>Promoter</Txt></View>
            <Muted style={styles.meta}>{promoter.city} · {promoter.showRate}% show-up rate</Muted>
          </View>
        </View>

        <View style={styles.stat3}>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{followerCount}</Txt>
            <Muted style={styles.statLabel}>followers</Muted>
          </View>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{promoter.eventsPromoted}</Txt>
            <Muted style={styles.statLabel}>events</Muted>
          </View>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{promoter.guestsBrought}</Txt>
            <Muted style={styles.statLabel}>guests brought</Muted>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button label={following ? 'Following ✓' : '+ Follow'} variant={following ? 'ghost' : 'primary'} onPress={toggleFollow} style={styles.followBtn} />
          <Pressable style={styles.iconRound} onPress={share}>
            <Share2 size={14} color={colors.muted} />
          </Pressable>
        </View>

        {promoter.links.length > 0 && (
          <View style={styles.socialRow}>
            {promoter.links.map((link) => (
              <Pressable key={link} style={styles.socialBtn} onPress={() => Linking.openURL(link).catch(() => {})}>
                <SocialIcon platform={guessPlatform(link)} size={18} color={colors.text} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Txt style={styles.cardHead}>About</Txt>
          <Muted style={styles.about}>{promoter.bio ? htmlToPlainText(promoter.bio) : 'No bio yet.'}</Muted>
          <View style={styles.kvList}>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Based in</Muted>
              <Txt style={styles.kvVal}>{promoter.city}</Txt>
            </View>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Show-up rate</Muted>
              <Txt style={[styles.kvVal, styles.kvAccent]}>{promoter.showRate}%</Txt>
            </View>
            <View style={[styles.kv, styles.kvLast]}>
              <Muted style={styles.kvKey}>Verified</Muted>
              {promoter.verified ? (
                <View style={styles.verifiedRow}><BadgeCheck size={13} color={colors.accent} /><Txt style={styles.verifiedTxt}>by Prebooze</Txt></View>
              ) : (
                <Muted style={styles.kvVal}>—</Muted>
              )}
            </View>
          </View>
        </View>

        <Txt style={styles.sectionLabel}>Promoting now ({promoting.length})</Txt>
        {promoting.length > 0 ? (
          <View style={styles.grid}>
            {promoting.map((ev) => (
              <EventGridCard key={ev.id} event={ev} isPast={false} onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
            ))}
          </View>
        ) : (
          <Muted style={styles.empty}>Not currently on any events' allow-list.</Muted>
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
  logoLetter: { color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 26 },
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
  kvAccent: { color: colors.accent, fontFamily: fontFamily.bold },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedTxt: { fontSize: fontSize.s, color: colors.accent },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s, marginTop: spacing.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, justifyContent: 'space-between' },
  empty: { marginBottom: spacing.m },
});
