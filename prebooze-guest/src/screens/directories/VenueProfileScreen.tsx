import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Clock, Heart, MapPin, Share2, Star, Users } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { ApiError } from '../../api/client';
import { haptics } from '../../lib/haptics';
import { htmlToPlainText } from '../../lib/richtext';
import { absoluteUrl } from '../../lib/urls';
import { formatLocation } from '../../lib/formatLocation';
import ReviewsSection from '../../components/ReviewsSection';
import EventGridCard from '../../components/EventGridCard';
import SocialIcon, { guessPlatform } from '../../components/SocialIcon';
import { Button, Chip, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, Venue, VenueDayKey } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'VenueProfile'; params: RootStackParamList['VenueProfile'] };

const DAY_LABELS: Record<VenueDayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DAY_ORDER: VenueDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function VenueProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  // The hero's page width has to track the real device width — a
  // hardcoded 390 cut/misaligned the slide on any screen wider or
  // narrower than that, since pagingEnabled snaps to multiples of the
  // image's own width, not the viewport's.
  const { width: screenW } = useWindowDimensions();
  const heroRef = useRef<ScrollView>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [favourited, setFavourited] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, social_] = await Promise.all([catalog.venue(route.params.id), social.mySocialState().catch(() => null)]);
      setVenue(v);
      setFollowerCount(v.followers);
      const key = `venue:${v.id}`;
      if (social_) {
        setFollowing(social_.following.includes(key));
        setFavourited(social_.favouriteVenues.includes(v.id));
      }
      setEvents(await catalog.events({ venueId: v.id }));
    } catch {
      // leave venue null
    }
  }, [route.params.id]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!venue) return;
    const key = `venue:${venue.id}`;
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

  const share = () => {
    if (!venue) return;
    Share.share({ message: `${venue.name} on Prebooze — ${absoluteUrl(`/venues/${venue.id}`)}` }).catch(() => {});
  };

  const toggleFav = async () => {
    if (!venue) return;
    const was = favourited;
    setFavourited(!was);
    try {
      await social.favVenue(venue.id, !was);
    } catch (e) {
      setFavourited(was);
      Alert.alert('Could not update favourite', e instanceof ApiError ? e.message : 'Try again.');
    }
  };

  if (!venue) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const gallery = venue.galleryUrls?.length ? venue.galleryUrls : [];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 >= now);
  const past = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < now);
  const mapQuery = encodeURIComponent(`${venue.name}, ${venue.address}`);
  const social_ = venue.socialLinks;
  const hasSocial = !!(social_?.instagram || social_?.facebook || social_?.other?.length);

  return (
    <Screen>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} enableOnAndroid enableAutomaticScroll extraScrollHeight={220} extraHeight={220} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          {gallery.length > 0 ? (
            <ScrollView
              ref={heroRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / screenW))}
              scrollEventThrottle={32}
            >
              {gallery.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={[styles.heroImg, { width: screenW }]} contentFit="cover" onError={() => {}} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.heroImg, { width: screenW, backgroundColor: `hsl(${venue.photoHue} 45% 22%)` }]} />
          )}
          {gallery.length > 1 && (
            <>
              {heroIndex > 0 && (
                <Pressable style={[styles.heroArrow, styles.heroArrowLeft]} onPress={() => heroRef.current?.scrollTo({ x: (heroIndex - 1) * screenW, animated: true })}>
                  <ChevronLeft size={20} color="#fff" />
                </Pressable>
              )}
              {heroIndex < gallery.length - 1 && (
                <Pressable style={[styles.heroArrow, styles.heroArrowRight]} onPress={() => heroRef.current?.scrollTo({ x: (heroIndex + 1) * screenW, animated: true })}>
                  <ChevronRight size={20} color="#fff" />
                </Pressable>
              )}
              <View style={styles.dotsRow}>
                {gallery.map((_, i) => (
                  <View key={i} style={[styles.dot, i === heroIndex && styles.dotOn]} />
                ))}
              </View>
            </>
          )}
          <IconButton onPress={() => navigation.goBack()} style={styles.heroBtn}>
            <ArrowLeft size={18} color={colors.text} />
          </IconButton>
          <IconButton onPress={share} style={[styles.heroBtn, styles.heroBtnRight]}>
            <Share2 size={16} color={colors.text} />
          </IconButton>
        </View>

        <View style={styles.body}>
          <View style={styles.headRow}>
            <View style={[styles.logo, { backgroundColor: `hsl(${venue.photoHue} 45% 30%)` }]}>
              {venue.logoUrl ? <Image source={{ uri: venue.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.logoLetter}>{venue.name[0]}</Txt>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Txt style={styles.name}>{venue.name}</Txt>
                {venue.verified && <BadgeCheck size={16} color={colors.accent} />}
              </View>
              <Muted style={styles.meta}>{venue.type} · {venue.locality}, {venue.city}</Muted>
              <Muted style={styles.meta}>{venue.eventsHosted} event{venue.eventsHosted === 1 ? '' : 's'} hosted</Muted>
            </View>
          </View>

          {/* Boxed 3-up stat grid — same .stat3 pattern as Organizer/Lineup/
              Promoter (bordered surface boxes) rather than one merged row. */}
          <View style={styles.stat3}>
            <View style={styles.statBox}>
              <View style={styles.statIconRow}><Star size={13} color={colors.accent} /><Txt style={styles.statVal}>{venue.rating.toFixed(1)}</Txt></View>
              <Muted style={styles.statLabel}>{venue.reviewCount ?? 0} reviews</Muted>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statIconRow}><Users size={13} color={colors.muted} /><Txt style={styles.statVal}>{venue.capacity}</Txt></View>
              <Muted style={styles.statLabel}>capacity</Muted>
            </View>
            <View style={styles.statBox}>
              <Txt style={styles.statVal}>{followerCount}</Txt>
              <Muted style={styles.statLabel}>followers</Muted>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Button label={following ? 'Following' : 'Follow'} variant={following ? 'ghost' : 'primary'} onPress={toggleFollow} style={{ flex: 1 }} />
            <Pressable style={styles.favBtn} onPress={toggleFav}>
              <Heart size={15} color={favourited ? colors.accent : colors.text} fill={favourited ? colors.accent : 'transparent'} />
              <Txt style={styles.favBtnTxt}>{favourited ? 'Favourited' : 'Favourite'}</Txt>
            </Pressable>
          </View>

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

          <View style={styles.addressRow}>
            <MapPin size={13} color={colors.muted} />
            <Muted style={styles.addressTxt}>{venue.address}, {formatLocation(venue)}</Muted>
          </View>
          <Button label="Get directions" variant="ghost" onPress={() => Linking.openURL(`https://maps.google.com/?q=${mapQuery}`)} style={styles.directionsBtn} />

          {venue.amenities.length > 0 && (
            <View style={styles.chipRow}>
              {venue.amenities.map((a) => <Chip key={a} label={a} />)}
            </View>
          )}

          {!!venue.about && <Muted style={styles.about}>{htmlToPlainText(venue.about)}</Muted>}

          {(venue.timingsByDay || venue.timings) && (
            <View style={styles.timingsCard}>
              <View style={styles.timingsHeadRow}>
                <Clock size={14} color={colors.text} />
                <Txt style={styles.timingsHead}>Timings</Txt>
              </View>
              {venue.timingsByDay ? (
                DAY_ORDER.map((d) => {
                  const t = venue.timingsByDay?.[d];
                  if (!t) return null;
                  return (
                    <View key={d} style={styles.timingRow}>
                      <Muted style={styles.timingDay}>{DAY_LABELS[d]}</Muted>
                      <Muted style={styles.timingHours}>{t.closed ? 'Closed' : `${t.open} – ${t.close}`}</Muted>
                    </View>
                  );
                })
              ) : (
                <Muted style={styles.timingHours}>{venue.timings}</Muted>
              )}
            </View>
          )}

          {upcoming.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Upcoming events here</Txt>
              <View style={styles.grid}>
                {upcoming.map((ev) => (
                  <EventGridCard key={ev.id} event={ev} isPast={false} onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
                ))}
              </View>
            </>
          )}

          {past.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Past events</Txt>
              <View style={styles.grid}>
                {past.map((ev) => (
                  <EventGridCard key={ev.id} event={ev} isPast onPress={() => navigation.push('EventDetail', { slug: ev.slug })} />
                ))}
              </View>
            </>
          )}

          <ReviewsSection targetType="venue" targetId={venue.id} prompt="How was this venue — sound, entry, staff?" />
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxl },
  hero: { height: 240, backgroundColor: colors.surface2 },
  heroImg: { height: 240 },
  heroBtn: { position: 'absolute', top: spacing.m, left: spacing.m, backgroundColor: 'rgba(20,21,15,0.55)' },
  heroBtnRight: { left: undefined, right: spacing.m },
  heroArrow: { position: 'absolute', top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(20,21,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  heroArrowLeft: { left: spacing.s },
  heroArrowRight: { right: spacing.s },
  dotsRow: { position: 'absolute', bottom: spacing.s, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { backgroundColor: colors.accent, width: 16 },
  body: { padding: spacing.l },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginBottom: spacing.m },
  logo: { width: 52, height: 52, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoLetter: { color: '#fff', fontFamily: fontFamily.extrabold, fontSize: fontSize.l },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  meta: { marginTop: 2 },
  stat3: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.m, alignItems: 'center' },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statVal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.m },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  favBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingHorizontal: spacing.m, justifyContent: 'center' },
  favBtnTxt: { fontSize: fontSize.s, fontFamily: fontFamily.medium },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: spacing.s },
  addressTxt: { fontSize: fontSize.xs, flex: 1 },
  directionsBtn: { marginBottom: spacing.l },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.l },
  about: { lineHeight: 20, marginBottom: spacing.m },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.l, justifyContent: 'center' },
  socialBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timingsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.l },
  timingsHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  timingsHead: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  timingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  timingDay: { fontSize: fontSize.xs },
  timingHours: { fontSize: fontSize.xs },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s, marginTop: spacing.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, justifyContent: 'space-between' },
});
