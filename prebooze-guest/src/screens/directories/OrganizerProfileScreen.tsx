import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck, CheckCircle2, Share2, Star } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { ApiError } from '../../api/client';
import { haptics } from '../../lib/haptics';
import { htmlToPlainText } from '../../lib/richtext';
import { absoluteUrl, eventCity } from '../../lib/urls';
import { formatLocation } from '../../lib/formatLocation';
import ReviewsSection from '../../components/ReviewsSection';
import EventGridCard from '../../components/EventGridCard';
import SocialIcon, { guessPlatform } from '../../components/SocialIcon';
import { Button, Chip, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, Organizer } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'OrganizerProfile'; params: RootStackParamList['OrganizerProfile'] };

export default function OrganizerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const [org, setOrg] = useState<Organizer | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [following, setFollowing] = useState(false);
  // Real bug: org.followers is a snapshot from the fetch — toggling follow
  // never touched it, so the count on screen stayed stale until the guest
  // left and came back. Tracked separately, nudged ±1 the instant the
  // button is tapped (and reverted if the request fails), same optimistic
  // pattern `following` itself already used.
  const [followerCount, setFollowerCount] = useState(0);
  const [cityFilter, setCityFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, social_] = await Promise.all([catalog.organizer(route.params.id), social.mySocialState().catch(() => null)]);
      setOrg(o);
      setFollowerCount(o.followers);
      if (social_) setFollowing(social_.following.includes(o.id));
      setEvents(await catalog.events({ organizerId: o.id }));
    } catch {
      // leave org null -> shows loading forever is acceptable fallback here; a retry affordance can come later
    }
  }, [route.params.id]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!org) return;
    const was = following;
    setFollowing(!was);
    haptics.tap();
    setFollowerCount((c) => c + (was ? -1 : 1));
    try {
      await (was ? social.unfollow(org.id) : social.follow(org.id));
    } catch (e) {
      setFollowing(was);
      setFollowerCount((c) => c + (was ? 1 : -1));
      haptics.error();
      Alert.alert('Could not update follow', e instanceof ApiError ? e.message : 'Try again.');
    }
  };

  const share = () => {
    if (!org) return;
    Share.share({ message: `${org.brandName} on Prebooze — ${absoluteUrl(`/organizers/${org.id}`)}` }).catch(() => {});
  };

  if (!org) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const social_ = org.socialLinks;
  const hasSocial = !!(social_?.instagram || social_?.facebook || social_?.other?.length);
  const eventTypes = org.eventTypes ? org.eventTypes.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const eventCities = [...new Set(events.map((e) => eventCity(e)).filter((c): c is string => !!c))].sort();
  const cityScoped = cityFilter ? events.filter((e) => eventCity(e) === cityFilter) : events;
  const now = Date.now();
  const upcoming = cityScoped.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 >= now);
  const past = cityScoped.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < now);
  const joined = org.createdAt
    ? new Date(org.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : org.since;

  return (
    <Screen>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} enableOnAndroid enableAutomaticScroll extraScrollHeight={220} extraHeight={220} keyboardShouldPersistTaps="handled">
        <View style={styles.backRow}>
          <IconButton onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.text} />
          </IconButton>
        </View>

        {/* Header: logo + name/username/chips, mirrors web OrganizerProfile's
            flex header row — identity block first, actions (social/follow/
            share) directly below since a phone-width column can't hold both
            side by side the way the web's wide flex row does. */}
        <View style={styles.headRow}>
          <View style={[styles.avatar, { backgroundColor: `hsl(${org.logoHue} 55% 40%)` }]}>
            {org.logoUrl ? <Image source={{ uri: org.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.avatarLetter}>{org.brandName[0]}</Txt>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Txt style={styles.name}>{org.brandName}</Txt>
              {org.verified && <BadgeCheck size={16} color={colors.accent} />}
            </View>
            <Muted style={styles.meta}>@{org.username} · {org.city} · since {org.since}</Muted>
            {eventTypes.length > 0 && (
              <View style={styles.typesRow}>
                {eventTypes.map((t) => <View key={t} style={styles.tag}><Txt style={styles.tagTxt}>{t}</Txt></View>)}
              </View>
            )}
          </View>
        </View>

        {/* Boxed 3-up stat grid — same .stat3 pattern as web (bordered
            surface boxes, big value + small muted label) rather than a plain
            row of numbers. */}
        <View style={styles.stat3}>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{followerCount}</Txt>
            <Muted style={styles.statLabel}>followers</Muted>
          </View>
          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              {org.reviewCount ? <><Txt style={styles.statVal}>{org.rating.toFixed(1)}</Txt><Star size={15} color={colors.text} /></> : <Txt style={styles.statVal}>—</Txt>}
            </View>
            <Muted style={styles.statLabel}>{org.reviewCount ? `${org.reviewCount} review${org.reviewCount === 1 ? '' : 's'}` : 'no reviews yet'}</Muted>
          </View>
          <View style={styles.statBox}>
            <Txt style={styles.statVal}>{org.eventsHosted}</Txt>
            <Muted style={styles.statLabel}>events hosted</Muted>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button label={following ? 'Following ✓' : '+ Follow'} variant={following ? 'ghost' : 'primary'} onPress={toggleFollow} style={styles.followBtn} />
          <Pressable style={styles.iconRound} onPress={share}>
            <Share2 size={14} color={colors.muted} />
          </Pressable>
        </View>

        {/* Dedicated row for social links, with room for however many a
            profile has — crammed into actionsRow next to Follow it got
            squeezed and clipped once there were 2+ links. */}
        {hasSocial && (
          <View style={styles.socialRow}>
            {!!social_?.instagram && (
              <Pressable style={styles.socialBtn} onPress={() => Linking.openURL(social_.instagram!.startsWith('http') ? social_.instagram! : `https://instagram.com/${social_.instagram}`)}>
                <SocialIcon platform="instagram" size={18} color={colors.text} />
              </Pressable>
            )}
            {!!social_?.facebook && (
              <Pressable style={styles.socialBtn} onPress={() => Linking.openURL(social_.facebook!.startsWith('http') ? social_.facebook! : `https://facebook.com/${social_.facebook}`)}>
                <SocialIcon platform="facebook" size={18} color={colors.text} />
              </Pressable>
            )}
            {social_?.other?.map((l, i) => (
              <Pressable key={i} style={styles.socialBtn} onPress={() => Linking.openURL(l.startsWith('http') ? l : `https://${l}`)}>
                <SocialIcon platform={guessPlatform(l)} size={18} color={colors.text} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Single bordered card holding About + the Based in/Joined/Verified
            kv rows — same .card + .kv (dashed separators) pattern as web's
            About card, rather than these being split across separate boxes. */}
        <View style={styles.card}>
          <Txt style={styles.cardHead}>About</Txt>
          <Muted style={styles.about}>{org.about ? htmlToPlainText(org.about) : 'No description yet.'}</Muted>
          <View style={styles.kvList}>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Based in</Muted>
              <Txt style={styles.kvVal}>{formatLocation(org)}</Txt>
            </View>
            <View style={styles.kv}>
              <Muted style={styles.kvKey}>Joined</Muted>
              <Txt style={styles.kvVal}>{joined}</Txt>
            </View>
            <View style={[styles.kv, styles.kvLast]}>
              <Muted style={styles.kvKey}>Verified</Muted>
              {org.verified ? (
                <View style={styles.verifiedRow}><BadgeCheck size={13} color={colors.accent} /><Txt style={styles.verifiedTxt}>by Prebooze</Txt></View>
              ) : (
                <Muted style={styles.kvVal}>pending</Muted>
              )}
            </View>
          </View>
        </View>

        {eventCities.length > 1 && (
          <View style={styles.typesRow}>
            <Chip label="All cities" active={cityFilter === ''} onPress={() => setCityFilter('')} />
            {eventCities.map((c) => (
              <Chip key={c} label={c} active={cityFilter === c} onPress={() => setCityFilter(cityFilter === c ? '' : c)} />
            ))}
          </View>
        )}

        <Txt style={styles.sectionLabel}>Upcoming events ({upcoming.length})</Txt>
        {upcoming.length > 0 ? (
          <View style={styles.grid}>
            {upcoming.map((ev) => (
              <EventGridCard key={ev.id} event={ev} isPast={false} onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
            ))}
          </View>
        ) : (
          <Muted style={styles.empty}>No upcoming events published.</Muted>
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

        <ReviewsSection targetType="organizer" targetId={org.id} prompt="How was the event / organizer?" />
      </KeyboardAwareScrollView>
    </Screen>
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
  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  tag: { backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: spacing.s, paddingVertical: 4 },
  tagTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  iconRound: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  followBtn: { flex: 1 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.l, justifyContent: 'center' },
  socialBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stat3: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.m, alignItems: 'center' },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
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
