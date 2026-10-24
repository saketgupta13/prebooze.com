import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft, BadgeCheck, Calendar, CheckCircle2, Clock, Download, Eye, Flame, Frown, Hourglass,
  Landmark, Lock, MapPin, Martini, Megaphone, Mic, Minus, PartyPopper, Play, Plus, Share2,
  ShieldCheck, Tag, Ticket, X,
} from 'lucide-react-native';
import { displayMinPrice, displayTierPrice, hasCurrentlyPaidTier, tierCountdownLabel, tierWindowCaption } from '../../lib/ticketTierPricing';
import { useTicker } from '../../lib/useTicker';
import { isEventOver } from '../../lib/eventStatus';
import { existingRole, roleLabel } from '../../lib/roles';
import { catalog } from '../../api/catalog';
import { social } from '../../api/social';
import { bookingsApi } from '../../api/bookings';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { platform } from '../../api/platform';
import { htmlToPlainText } from '../../lib/richtext';
import { eventPath, absoluteUrl } from '../../lib/urls';
import { recordEventView } from '../../lib/recentlyViewed';
import { Button, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking, Event, GuestReview, LineupProfile, PromoterProfile, WaitlistEntry } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'EventDetail'; params: RootStackParamList['EventDetail'] };

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute() as Rt;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [err, setErr] = useState('');
  // Raw followeeKeys (bare organizer id / `venue:<id>`), same format
  // SocialService.follow uses — lets every host-area row (primary
  // organizer, co-organizers, venue) each own its real Follow state instead
  // of one shared boolean.
  const [followingKeys, setFollowingKeys] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [ticketSheetOpen, setTicketSheetOpen] = useState(false);
  // Event.lineup is free-text {name, role, instagramUrl?} JSON, not a real
  // relation — resolved against the real directory (name match, same as
  // EventDetail.tsx's findLineup) so a matched entry links to a real
  // profile instead of just showing plain text.
  const [lineups, setLineups] = useState<LineupProfile[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [promoters, setPromoters] = useState<PromoterProfile[]>([]);
  const [recommended, setRecommended] = useState<Event[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [salesPaused, setSalesPaused] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [interestedBusy, setInterestedBusy] = useState(false);

  const refetchWaitlist = useCallback((eventId: string) => {
    bookingsApi.waitlist(eventId).then(setWaitlist).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ev = await catalog.event(route.params.slug);
        setEvent(ev);
        recordEventView(ev).catch(() => {});
        const social_ = await social.mySocialState().catch(() => null);
        if (social_) {
          setFollowingKeys(new Set(social_.following));
          setInterestedIds(new Set(social_.interested));
        }
        if (ev.organizerId) social.organizerReviews(ev.organizerId).then(setReviews).catch(() => setReviews([]));
        catalog.events({ city: ev.venue?.city ?? ev.unlistedVenueCity ?? ev.privateCity ?? undefined })
          .then((all) => setRecommended(all.filter((x) => x.id !== ev.id).slice(0, 4)))
          .catch(() => setRecommended([]));
        bookingsApi.waitlist(ev.id).then(setWaitlist).catch(() => setWaitlist([]));
      } catch {
        setErr("Couldn't load this event.");
      }
    })();
    catalog.lineups().then(setLineups).catch(() => setLineups([]));
    catalog.promoters().then(setPromoters).catch(() => setPromoters([]));
    bookingsApi.list().then(setMyBookings).catch(() => setMyBookings([]));
    platform.settings().then((s) => setSalesPaused(!!s.salesPaused)).catch(() => {});
  }, [route.params.slug]);

  const findLineup = useCallback(
    (name: string) => lineups.find((l) => l.name.toLowerCase() === name.toLowerCase()),
    [lineups],
  );

  const onShare = useCallback(() => {
    if (!event) return;
    const evCity = event.venue?.city ?? event.unlistedVenueCity ?? event.privateCity ?? event.organizer?.city ?? '';
    const url = absoluteUrl(eventPath(evCity, event.slug));
    Share.share({ message: `${event.title} 🎟️ — book on Prebooze: ${url}`, url }).catch(() => {});
  }, [event]);

  const toggleFollow = useCallback(async (key: string) => {
    const wasFollowing = followingKeys.has(key);
    setFollowingKeys((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(key); else next.add(key);
      return next;
    });
    try {
      await (wasFollowing ? social.unfollow(key) : social.follow(key));
    } catch (e) {
      setFollowingKeys((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(key); else next.delete(key);
        return next;
      });
      Alert.alert('Could not update follow', e instanceof ApiError ? e.message : 'Try again.');
    }
  }, [followingKeys]);

  const toggleInterested = useCallback(async () => {
    if (!event) return;
    const wasInterested = interestedIds.has(event.id);
    setInterestedBusy(true);
    setInterestedIds((prev) => {
      const next = new Set(prev);
      if (wasInterested) next.delete(event.id); else next.add(event.id);
      return next;
    });
    try {
      await social.interested(event.id, !wasInterested);
    } catch (e) {
      setInterestedIds((prev) => {
        const next = new Set(prev);
        if (wasInterested) next.add(event.id); else next.delete(event.id);
        return next;
      });
      Alert.alert('Could not update', e instanceof ApiError ? e.message : 'Try again.');
    } finally {
      setInterestedBusy(false);
    }
  }, [event, interestedIds]);

  const joinWaitlist = useCallback(async () => {
    if (!event) return;
    setWaitlistBusy(true);
    try {
      await bookingsApi.waitlistJoin(event.id);
      refetchWaitlist(event.id);
    } catch (e) {
      Alert.alert('Could not join the waitlist', e instanceof ApiError ? e.message : 'Try again.');
    } finally {
      setWaitlistBusy(false);
    }
  }, [event, refetchWaitlist]);

  useTicker(); // keeps free-entry countdowns live without a reload

  const setTierQty = (tierId: string, delta: number, max: number) => {
    setQty((prev) => {
      const next = Math.min(max, Math.max(0, (prev[tierId] ?? 0) + delta));
      return { ...prev, [tierId]: next };
    });
  };

  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const minPrice = event?.tiers.length ? displayMinPrice(event.tiers, event.date) : 0;

  const goToCheckout = () => {
    if (!event) return;
    if (totalQty === 0) return;
    const selected = Object.fromEntries(Object.entries(qty).filter(([, n]) => n > 0));
    setTicketSheetOpen(false);
    navigation.navigate('Checkout', {
      eventSlug: event.slug,
      qty: selected,
      promoterRef: route.params.ref,
      promoterVia: route.params.via,
    });
  };

  if (err) {
    return (
      <Screen style={styles.center}>
        <Muted>{err}</Muted>
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.l }} />
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const city = event.venue?.city ?? event.unlistedVenueCity ?? event.privateCity ?? null;
  // "N going" social proof — same thresholding web's showGoing uses: only
  // shown once sales hit half of total capacity, so a low count never reads
  // as "nobody wants this."
  const going = event.tiers.reduce((a, t) => a + t.sold, 0);
  const cap = event.tiers.reduce((a, t) => a + t.quantity, 0);
  const showGoing = cap > 0 && going / cap >= 0.5;
  const eventOver = isEventOver(event);
  const allSoldOut = event.tiers.every((t) => t.sold >= t.quantity);
  const roleBlocked = existingRole(user);
  const status: 'going' | 'interested' | null = myBookings.some((b) => b.eventId === event.id && b.status !== 'cancelled')
    ? 'going'
    : interestedIds.has(event.id)
      ? 'interested'
      : null;
  const myEntry = user ? waitlist.find((w) => w.phone === user.phone) : undefined;
  const myPosition = myEntry ? waitlist.filter((w) => w.status === 'waiting').findIndex((w) => w.phone === user?.phone) + 1 : 0;
  const allowedPromoterSlugs = event.promoterConfig?.enabled ? (event.promoterConfig.allowedPromoters ?? []) : [];
  const taggedPromoters = promoters.filter((p) => allowedPromoterSlugs.includes(p.slug));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {event.posterUrl ? (
            <Image source={{ uri: event.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <View style={styles.heroOverlay} />
          <IconButton onPress={() => navigation.goBack()} style={styles.heroBtn}>
            <ArrowLeft size={18} color={colors.text} />
          </IconButton>
          <IconButton onPress={onShare} style={[styles.heroBtn, styles.heroBtnRight]}>
            <Share2 size={16} color={colors.text} />
          </IconButton>
        </View>

        <View style={styles.body}>
          <Txt style={styles.title}>{event.title}</Txt>

          {(event.tags.length > 0 || event.socialBanners?.storyUrl) && (
            <View style={styles.tagsRow}>
              {event.tags.map((t) => (
                <View key={t} style={styles.tagChip}>
                  <Txt style={styles.tagChipTxt}>{t}</Txt>
                </View>
              ))}
              {!!event.socialBanners?.storyUrl && (
                <Pressable style={styles.tagChip} onPress={() => Linking.openURL(event.socialBanners!.storyUrl!)}>
                  <Download size={12} color={colors.text} />
                  <Txt style={styles.tagChipTxt}>Story image</Txt>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.metaRow}>
            <Calendar size={15} color={colors.muted} />
            <Txt style={styles.metaTxt}>{fmtDateTime(event.date)}</Txt>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={15} color={colors.muted} />
            <Txt style={styles.metaTxt}>
              {event.venue?.name ?? event.unlistedVenueName ?? event.privateLocality ?? 'Location shared after booking'}
              {!!city && `, ${city}`}
            </Txt>
          </View>
          <View style={[styles.metaRow, styles.metaRowWrap]}>
            <Tag size={15} color={colors.muted} />
            <Txt style={styles.metaTxt}>{event.subCategory ? `${event.category} · ${event.subCategory}` : event.category}</Txt>
            <Txt style={styles.metaDot}>·</Txt>
            <ShieldCheck size={15} color={colors.muted} />
            <Txt style={styles.metaTxt}>{event.ageLimit}</Txt>
            <Txt style={styles.metaDot}>·</Txt>
            <Clock size={15} color={colors.muted} />
            <Txt style={styles.metaTxt}>{event.durationHrs} hrs</Txt>
          </View>

          <View style={styles.hostStack}>
            {!!event.organizer && (
              <Pressable style={styles.orgRow} onPress={() => navigation.navigate('OrganizerProfile', { id: event.organizer!.id })}>
                <View style={[styles.orgAvatar, { backgroundColor: `hsl(${event.organizer.logoHue} 55% 40%)` }]}>
                  {event.organizer.logoUrl ? (
                    <Image source={{ uri: event.organizer.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Txt style={styles.orgAvatarLetter}>{event.organizer.brandName[0]}</Txt>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Muted style={styles.hostLabel}>{event.hostedByVenue ? 'In collaboration with' : 'Hosted by'}</Muted>
                  <View style={styles.orgNameRow}>
                    <Txt style={styles.orgName}>{event.organizer.brandName}</Txt>
                    {event.organizer.verified && <BadgeCheck size={14} color={colors.accent} />}
                  </View>
                </View>
                <Button
                  label={followingKeys.has(event.organizer.id) ? 'Following' : 'Follow'}
                  variant={followingKeys.has(event.organizer.id) ? 'ghost' : 'primary'}
                  onPress={() => toggleFollow(event.organizer!.id)}
                  style={styles.followBtn}
                />
              </Pressable>
            )}

            {/* Real, registered co-organizers (Event.collaborators) — a full-
                access collaboration, distinct from the hostedByVenue single-
                collaborator case above. */}
            {(event.collaborators ?? []).map((c) => (
              <Pressable key={c.id} style={styles.hostRow} onPress={() => navigation.navigate('OrganizerProfile', { id: c.id })}>
                <View style={[styles.orgAvatar, { backgroundColor: `hsl(${c.logoHue} 55% 40%)` }]}>
                  {c.logoUrl ? (
                    <Image source={{ uri: c.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Txt style={styles.orgAvatarLetter}>{c.brandName[0]}</Txt>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Muted style={styles.hostLabel}>In collaboration with</Muted>
                  <View style={styles.orgNameRow}>
                    <Txt style={styles.orgName}>{c.brandName}</Txt>
                    {c.verified && <BadgeCheck size={14} color={colors.accent} />}
                  </View>
                </View>
                <Button
                  label={followingKeys.has(c.id) ? 'Following' : 'Follow'}
                  variant={followingKeys.has(c.id) ? 'ghost' : 'primary'}
                  onPress={() => toggleFollow(c.id)}
                  style={styles.followBtn}
                />
              </Pressable>
            ))}

            {/* Display-only co-host credits (Event.freeTextCollaborators) —
                a typed name not on Prebooze, no access/revenue implications. */}
            {(event.freeTextCollaborators ?? []).map((c) =>
              c.instagramUrl ? (
                <Pressable key={c.name} style={styles.hostRow} onPress={() => Linking.openURL(c.instagramUrl!)}>
                  <View style={styles.hostIconAvatar}>
                    <Landmark size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Muted style={styles.hostLabel}>Co-hosted by</Muted>
                    <Txt style={styles.orgName}>{c.name}</Txt>
                  </View>
                  <Muted style={styles.hostLink}>Instagram →</Muted>
                </Pressable>
              ) : (
                <View key={c.name} style={styles.hostRow}>
                  <View style={styles.hostIconAvatar}>
                    <Landmark size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Muted style={styles.hostLabel}>Co-hosted by</Muted>
                    <Txt style={styles.orgName}>{c.name}</Txt>
                  </View>
                </View>
              ),
            )}

            {event.venue ? (
              <Pressable style={styles.hostRow} onPress={() => navigation.navigate('VenueProfile', { id: event.venue!.id })}>
                <View style={[styles.orgAvatar, { backgroundColor: colors.surface2 }]}>
                  {event.venue.logoUrl ? (
                    <Image source={{ uri: event.venue.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Landmark size={18} color={colors.text} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Muted style={styles.hostLabel}>{event.hostedByVenue ? 'Hosted by' : 'Hosted at'}</Muted>
                  <View style={styles.orgNameRow}>
                    <Txt style={styles.orgName}>{event.venue.name}</Txt>
                    {event.venue.verified && <BadgeCheck size={14} color={colors.accent} />}
                  </View>
                </View>
                <Button
                  label={followingKeys.has(`venue:${event.venue.id}`) ? 'Following' : 'Follow'}
                  variant={followingKeys.has(`venue:${event.venue.id}`) ? 'ghost' : 'primary'}
                  onPress={() => toggleFollow(`venue:${event.venue!.id}`)}
                  style={styles.followBtn}
                />
              </Pressable>
            ) : event.unlistedVenueName ? (
              event.unlistedVenueInstagramUrl ? (
                <Pressable style={styles.hostRow} onPress={() => Linking.openURL(event.unlistedVenueInstagramUrl!)}>
                  <View style={styles.hostIconAvatar}>
                    <Landmark size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Muted style={styles.hostLabel}>Hosted at</Muted>
                    <Txt style={styles.orgName}>{event.unlistedVenueName}</Txt>
                  </View>
                  <Muted style={styles.hostLink}>Instagram →</Muted>
                </Pressable>
              ) : (
                <View style={styles.hostRow}>
                  <View style={styles.hostIconAvatar}>
                    <Landmark size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Muted style={styles.hostLabel}>Hosted at</Muted>
                    <Txt style={styles.orgName}>{event.unlistedVenueName}</Txt>
                  </View>
                  {!!event.unlistedVenueAddress && <Muted style={styles.hostAddr}>{event.unlistedVenueAddress}</Muted>}
                </View>
              )
            ) : null}
          </View>

          <View style={styles.goingRow}>
            <View style={styles.goingRowLeft}>
              {showGoing ? (
                <>
                  <Flame size={14} color={colors.accent} />
                  <Txt style={styles.goingTxt}>{going.toLocaleString('en-IN')} going</Txt>
                </>
              ) : going === 0 ? (
                <>
                  <Eye size={14} color={colors.muted} />
                  <Muted style={styles.goingTxt}>Be the first to go</Muted>
                </>
              ) : (
                <>
                  <Eye size={14} color={colors.muted} />
                  <Muted style={styles.goingTxt}>Guests are already going</Muted>
                </>
              )}
            </View>
            {status === 'going' ? (
              <View style={styles.goingBadge}>
                <CheckCircle2 size={13} color={colors.accent} />
                <Txt style={styles.goingBadgeTxt}>You're going</Txt>
              </View>
            ) : !roleBlocked ? (
              <Button
                label={status === 'interested' ? '★ Interested' : '☆ Interested'}
                variant={status === 'interested' ? 'primary' : 'ghost'}
                disabled={interestedBusy}
                onPress={toggleInterested}
                style={styles.interestedBtn}
              />
            ) : null}
          </View>

          <Txt style={styles.sectionLabel}>About this event</Txt>
          <Muted style={styles.desc} numberOfLines={descExpanded ? undefined : 5}>
            {htmlToPlainText(event.description)}
          </Muted>
          {/* Invisible, unclamped twin — only way to learn the real line
              count, since onTextLayout on the clamped Text above reports
              layout AFTER numberOfLines already truncated it (always <=5,
              so it could never detect overflow on its own). */}
          <Muted
            style={[styles.desc, styles.descMeasure]}
            onTextLayout={(e) => setDescClamped(e.nativeEvent.lines.length > 5)}
          >
            {htmlToPlainText(event.description)}
          </Muted>
          {descClamped && (
            <Pressable onPress={() => setDescExpanded((v) => !v)}>
              <Txt style={styles.readMore}>{descExpanded ? 'Read less' : 'Read more'}</Txt>
            </Pressable>
          )}

          {event.conditions.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Know before you go</Txt>
              {event.conditions.map((c, i) => (
                <Txt key={i} style={styles.condition}>• {c}</Txt>
              ))}
            </>
          )}

          {event.lineup.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Line-up & partners</Txt>
              <View style={styles.hostStack}>
              {event.lineup.map((l) => {
                const profile = findLineup(l.name);
                const avatarAndName = (
                  <>
                    <View style={styles.hostIconAvatar}>
                      {profile?.logoUrl ? (
                        <Image source={{ uri: profile.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <Mic size={18} color={colors.text} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.orgNameRow}>
                        <Txt style={styles.orgName}>{l.name}</Txt>
                        {profile?.verified && <BadgeCheck size={14} color={colors.accent} />}
                      </View>
                      <Muted style={styles.hostLabel}>{l.role}</Muted>
                    </View>
                  </>
                );
                if (profile) {
                  const key = `lineup:${profile.slug}`;
                  return (
                    <Pressable key={l.name} style={styles.hostRow} onPress={() => navigation.navigate('LineupProfile', { slug: profile.slug })}>
                      {avatarAndName}
                      <Button
                        label={followingKeys.has(key) ? 'Following' : 'Follow'}
                        variant={followingKeys.has(key) ? 'ghost' : 'primary'}
                        onPress={() => toggleFollow(key)}
                        style={styles.followBtn}
                      />
                    </Pressable>
                  );
                }
                return l.instagramUrl ? (
                  <Pressable key={l.name} style={styles.hostRow} onPress={() => Linking.openURL(l.instagramUrl!)}>
                    {avatarAndName}
                    <Muted style={styles.hostLink}>Instagram →</Muted>
                  </Pressable>
                ) : (
                  <View key={l.name} style={styles.hostRow}>
                    {avatarAndName}
                  </View>
                );
              })}
              </View>
            </>
          )}

          {!!event.galleryUrls?.length && (
            <>
              <Txt style={styles.sectionLabel}>Gallery</Txt>
              <View style={styles.galleryGrid}>
                {event.galleryUrls.map((url, i) => (
                  <Pressable key={i} style={styles.galleryThumb} onPress={() => setGalleryIndex(i)}>
                    <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {!!event.teaserVideoUrl && (
            <>
              <Txt style={styles.sectionLabel}>Teaser</Txt>
              <Pressable style={styles.reelCard} onPress={() => Linking.openURL(event.teaserVideoUrl!)}>
                {event.posterUrl ? (
                  <Image source={{ uri: event.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : null}
                <View style={styles.reelOverlay} />
                <View style={styles.reelPlayBtn}>
                  <Play size={22} color={colors.onAccent} fill={colors.onAccent} />
                </View>
                <Txt style={styles.reelLabel}>Watch teaser</Txt>
              </Pressable>
            </>
          )}

          {taggedPromoters.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Promoted by</Txt>
              <View style={styles.hostStack}>
                {taggedPromoters.map((p) => (
                  <Pressable key={p.slug} style={styles.hostRow} onPress={() => navigation.navigate('PromoterProfile', { slug: p.slug })}>
                    <View style={styles.hostIconAvatar}>
                      <Megaphone size={18} color={colors.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.orgNameRow}>
                        <Txt style={styles.orgName}>{p.name}</Txt>
                        {p.verified && <BadgeCheck size={14} color={colors.accent} />}
                      </View>
                      <Muted style={styles.hostLabel}>Free-entry guest list</Muted>
                    </View>
                    <Muted style={styles.hostLink}>View →</Muted>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {!!event.organizer && (
            <>
              <Txt style={styles.sectionLabel}>Organizer rating & reviews</Txt>
              <View style={styles.reviewsCard}>
                <View style={styles.reviewsHead}>
                  <Txt style={styles.reviewsRating}>{event.organizer.rating}</Txt>
                  <Txt style={styles.stars}>
                    {'★'.repeat(Math.floor(event.organizer.rating))}
                    {event.organizer.rating % 1 >= 0.5 ? '½' : ''}
                    {'☆'.repeat(5 - Math.floor(event.organizer.rating) - (event.organizer.rating % 1 >= 0.5 ? 1 : 0))}
                  </Txt>
                  <Muted style={styles.reviewsCount}>· {event.organizer.reviewCount} reviews of {event.organizer.brandName}</Muted>
                </View>
                {reviews.slice(0, 2).map((r) => (
                  <View key={r.id} style={styles.reviewRow}>
                    <Txt style={styles.reviewAuthor}>
                      {r.author} · {'★'.repeat(Math.round(r.rating))}
                      {r.eventTitle ? <Muted> · {r.eventTitle}</Muted> : null}
                    </Txt>
                    <Muted style={styles.reviewText}>"{r.text}"</Muted>
                  </View>
                ))}
                {reviews.length === 0 && <Muted style={styles.reviewsEmpty}>No reviews yet.</Muted>}
                <Pressable onPress={() => navigation.navigate('OrganizerProfile', { id: event.organizer!.id })}>
                  <Txt style={styles.readMore}>Read all reviews →</Txt>
                </Pressable>
              </View>
            </>
          )}

          {recommended.length > 0 && (
            <>
              <Txt style={styles.sectionLabel}>Recommended events{city ? ` in ${city}` : ''}</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recRow}>
                {recommended.map((ev) => (
                  <Pressable key={ev.id} style={styles.recCard} onPress={() => navigation.navigate('EventDetail', { slug: ev.slug })}>
                    <View style={styles.recPoster}>
                      {ev.posterUrl ? <Image source={{ uri: ev.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                    </View>
                    <Txt style={styles.recTitle} numberOfLines={2}>{ev.title}</Txt>
                    <Muted style={styles.recVenue} numberOfLines={1}>{ev.venue?.name ?? ev.privateCity ?? city}</Muted>
                    <Txt style={styles.recPrice}>{ev.minPrice ? `From ₹${ev.minPrice}` : 'Free'}</Txt>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: spacing.l + insets.bottom }]}>
        <Button
          label={
            eventOver
              ? 'Sold out'
              : allSoldOut
                ? 'Sold out — join the waitlist'
                : `Book ticket — ${minPrice > 0 || hasCurrentlyPaidTier(event.tiers, event.date) ? `from ₹${minPrice}` : 'Free'}`
          }
          onPress={() => setTicketSheetOpen(true)}
          style={styles.bookBtn}
        />
      </View>

      <Modal visible={ticketSheetOpen} animationType="slide" transparent onRequestClose={() => setTicketSheetOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Txt style={styles.sheetTitle}>Select tickets</Txt>
              <Pressable onPress={() => setTicketSheetOpen(false)} style={styles.sheetCloseBtn}>
                <X size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll}>
              {event.tiers.map((tier) => {
                const left = tier.quantity - tier.sold;
                const soldOut = left <= 0 || eventOver;
                const price = displayTierPrice(tier, event.date);
                const countdown = tierCountdownLabel(tier, event.date);
                const windowCaption = tierWindowCaption(tier, event.date);
                return (
                  <View key={tier.id} style={styles.tierRow}>
                    <View style={{ flex: 1 }}>
                      <Txt style={styles.tierName}>
                        {tier.name} — {price > 0 ? `₹${price}` : 'Free'}
                        {!soldOut && left <= 25 && <Txt style={styles.tierLeft}> · {left} left</Txt>}
                      </Txt>
                      {tier.includes.length > 0 && (
                        <View style={styles.includesRow}>
                          {tier.includes.map((inc, i) => (
                            <View key={i} style={styles.includesItem}>
                              {i > 0 && <Muted style={styles.includesDot}>·</Muted>}
                              <CheckCircle2 size={11} color={colors.muted} />
                              <Muted style={styles.includesTxt}>{inc}</Muted>
                            </View>
                          ))}
                        </View>
                      )}
                      {!!tier.description && <Muted style={styles.tierDesc}>{tier.description}</Muted>}
                      {!!countdown && (
                        <View style={styles.tierCountdownRow}>
                          <Hourglass size={11} color={colors.accent} />
                          <Txt style={styles.tierCountdownTxt}>{countdown} left at this price</Txt>
                        </View>
                      )}
                      {!!windowCaption && <Muted style={styles.tierCaption}>{windowCaption}</Muted>}
                      {!!tier.coverCharge && (
                        <View style={styles.tierCountdownRow}>
                          <Martini size={13} color={colors.accent} />
                          <Txt style={styles.tierCountdownTxt}>
                            Includes ₹{tier.coverCharge} redeemable at the venue{tier.coverChargeNote ? ` (${tier.coverChargeNote})` : ''}
                          </Txt>
                        </View>
                      )}
                    </View>
                    {soldOut ? (
                      <Txt style={styles.soldOutBadge}>sold out</Txt>
                    ) : (
                      <View style={styles.stepperRow}>
                        <Pressable style={styles.stepBtn} onPress={() => setTierQty(tier.id, -1, Math.min(10, left))}>
                          <Minus size={14} color={colors.text} />
                        </Pressable>
                        <Txt style={styles.stepVal}>{qty[tier.id] ?? 0}</Txt>
                        <Pressable style={styles.stepBtn} onPress={() => setTierQty(tier.id, 1, Math.min(10, left))}>
                          <Plus size={14} color={colors.accent} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Txt style={styles.totalLabel}>Total</Txt>
                <Txt style={styles.totalValue}>
                  ₹{event.tiers.reduce((a, t) => a + (qty[t.id] ?? 0) * displayTierPrice(t, event.date), 0)}
                </Txt>
              </View>
            </ScrollView>

            {eventOver ? (
              <View style={styles.dashedBox}>
                <View style={styles.dashedBoxHead}>
                  <Txt style={styles.dashedBoxTitle}>Sold out</Txt>
                  <Frown size={16} color={colors.text} />
                </View>
                <Muted style={styles.dashedBoxSub}>This event has already happened.</Muted>
              </View>
            ) : allSoldOut ? (
              <View style={styles.dashedBox}>
                <View style={styles.dashedBoxHead}>
                  <Txt style={styles.dashedBoxTitle}>Sold out</Txt>
                  <Frown size={16} color={colors.text} />
                </View>
                {myEntry?.status === 'offered' ? (
                  <>
                    <View style={styles.dashedBoxHead}>
                      <PartyPopper size={14} color={colors.accent} />
                      <Txt style={styles.offeredTxt}>A spot just opened up for you!</Txt>
                    </View>
                    <Muted style={styles.dashedBoxSub}>First come, first served — complete your booking before it's re-offered.</Muted>
                  </>
                ) : myEntry ? (
                  <>
                    <Txt style={styles.offeredTxt}>You're #{myPosition} in the waitlist</Txt>
                    <Muted style={styles.dashedBoxSub}>If someone cancels, spots are offered first-come first-served. We'll ping your WhatsApp.</Muted>
                  </>
                ) : (
                  <>
                    <Muted style={styles.dashedBoxSub}>Join the waitlist — if a ticket frees up (cancellation), it's offered in queue order.</Muted>
                    <Button
                      label={waitlistBusy ? 'Joining…' : `Join the waitlist (${waitlist.filter((w) => w.status === 'waiting').length} waiting)`}
                      loading={waitlistBusy}
                      onPress={joinWaitlist}
                      style={styles.sheetBookBtn}
                    />
                  </>
                )}
              </View>
            ) : roleBlocked ? (
              <View style={styles.dashedBoxRow}>
                <Lock size={13} color={colors.text} />
                <Txt style={styles.dashedBoxRowTxt}>{roleLabel(roleBlocked)} accounts can't book tickets — use a personal number to attend as a guest.</Txt>
              </View>
            ) : salesPaused ? (
              <View style={styles.dashedBoxRow}>
                <Ticket size={13} color={colors.text} />
                <Txt style={styles.dashedBoxRowTxt}>Ticket sales are temporarily paused platform-wide — check back shortly.</Txt>
              </View>
            ) : (
              <>
                <Button
                  label={totalQty === 0 ? 'Select tickets' : `Book ${totalQty} ticket${totalQty > 1 ? 's' : ''}`}
                  disabled={totalQty === 0}
                  onPress={goToCheckout}
                  style={styles.sheetBookBtn}
                />
                <View style={styles.trustRow}>
                  <Lock size={11} color={colors.muted} />
                  <Muted style={styles.trustTxt}>secure checkout · </Muted>
                  {/* WebBrowser forces a real browser tab — Linking.openURL
                      to prebooze.com now resolves back into this same app
                      (verified App Links handler) and silently no-ops on
                      an unmapped path like this one. */}
                  <Pressable onPress={() => WebBrowser.openBrowserAsync(absoluteUrl('/legal/refund-policy'))}>
                    <Txt style={styles.trustLink}>cancel any time before the event</Txt>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={galleryIndex !== null} animationType="fade" transparent onRequestClose={() => setGalleryIndex(null)}>
        <View style={styles.lightboxBackdrop}>
          <Pressable style={[styles.lightboxCloseBtn, { top: insets.top + spacing.m }]} onPress={() => setGalleryIndex(null)}>
            <X size={20} color="#fff" />
          </Pressable>
          {galleryIndex !== null && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: galleryIndex * Dimensions.get('window').width, y: 0 }}
            >
              {(event.galleryUrls ?? []).map((url, i) => (
                <View key={i} style={styles.lightboxPage}>
                  <Image source={{ uri: url }} style={styles.lightboxImg} contentFit="contain" />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 110 },
  // Posters are uploaded portrait (web's Poster.tsx documents "3:4"), not
  // the landscape-ish box a fixed height produced — that crushed most of
  // the real banner off-screen top/bottom. aspectRatio instead of a fixed
  // height shows the whole poster uncropped at any screen width.
  hero: { aspectRatio: 3 / 4, backgroundColor: colors.surface2 },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.15)' },
  heroBtn: { position: 'absolute', top: spacing.m, left: spacing.m, backgroundColor: 'rgba(20,21,15,0.55)' },
  heroBtnRight: { left: undefined, right: spacing.m },
  body: { padding: spacing.l },
  title: { fontSize: fontSize.xxl, fontFamily: fontFamily.extrabold, marginBottom: spacing.s },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s },
  metaRowWrap: { flexWrap: 'wrap', rowGap: spacing.xs },
  metaTxt: { fontSize: fontSize.s },
  metaDot: { fontSize: fontSize.s, color: colors.muted, marginHorizontal: -2 },
  hostStack: { gap: spacing.s, marginVertical: spacing.l },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m },
  hostIconAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surface2 },
  hostLabel: { fontSize: fontSize.xs, marginBottom: 2 },
  hostLink: { fontSize: fontSize.s, color: colors.accent, fontFamily: fontFamily.medium },
  hostAddr: { fontSize: fontSize.xs, maxWidth: 110, textAlign: 'right' },
  orgAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orgAvatarLetter: { color: '#fff', fontFamily: fontFamily.bold },
  orgNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orgName: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  orgMeta: { fontSize: fontSize.xs },
  followBtn: { height: 36, paddingHorizontal: spacing.m },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s, marginTop: spacing.s },
  desc: { lineHeight: 20, marginBottom: spacing.m },
  tierRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.s, gap: spacing.m },
  tierName: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  tierPrice: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.m, marginTop: 2 },
  tierLeft: { color: colors.danger, fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  includesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  includesItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  includesDot: { fontSize: fontSize.xs },
  includesTxt: { fontSize: fontSize.xs },
  tierDesc: { fontSize: fontSize.xs, marginTop: 2 },
  tierCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tierCountdownTxt: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.xs, flexShrink: 1 },
  tierCaption: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 15 },
  soldOutBadge: { backgroundColor: 'rgba(255,92,73,0.12)', borderWidth: 1, borderColor: colors.danger, color: colors.danger, fontFamily: fontFamily.medium, fontSize: fontSize.xs, paddingHorizontal: spacing.s, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.s, paddingHorizontal: 2 },
  totalLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  totalValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.l, color: colors.accent },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border3, borderRadius: radius.m },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 20, textAlign: 'center', fontFamily: fontFamily.bold },
  condition: { fontSize: fontSize.s, color: colors.muted, lineHeight: 22 },
  reelCard: { height: 180, borderRadius: radius.l, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  reelOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  reelPlayBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  reelLabel: { position: 'absolute', bottom: spacing.m, left: spacing.m, color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.m },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  galleryThumb: {
    width: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    height: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    borderRadius: radius.s,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
  },
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  lightboxCloseBtn: { position: 'absolute', right: spacing.l, zIndex: 1, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxPage: { width: Dimensions.get('window').width, alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '100%' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.m,
    backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.l,
  },
  bookBtn: { flex: 1 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, padding: spacing.l, paddingBottom: spacing.xl, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
  sheetTitle: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  sheetCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sheetScroll: { maxHeight: 420 },
  sheetBookBtn: { marginTop: spacing.m },
  dashedBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border3, borderRadius: radius.m, padding: spacing.l, alignItems: 'center' },
  dashedBoxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 },
  dashedBoxTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  dashedBoxSub: { fontSize: fontSize.xs, textAlign: 'center' },
  offeredTxt: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.s, marginBottom: 4, textAlign: 'center' },
  dashedBoxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border3, borderRadius: radius.m, padding: spacing.m },
  dashedBoxRowTxt: { fontSize: fontSize.xs, flex: 1, lineHeight: 16 },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.s },
  trustTxt: { fontSize: fontSize.xs },
  trustLink: { fontSize: fontSize.xs, color: colors.accent, fontFamily: fontFamily.medium },
  goingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.m },
  goingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  goingTxt: { fontSize: fontSize.s, fontFamily: fontFamily.medium },
  goingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(155,225,61,0.14)', borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: spacing.m, paddingVertical: 6 },
  goingBadgeTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.accent },
  interestedBtn: { height: 32, paddingHorizontal: spacing.m },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.m },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border3, borderRadius: 999, paddingHorizontal: spacing.m, paddingVertical: 5 },
  tagChipTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  readMore: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: fontSize.s, marginTop: -4, marginBottom: spacing.m },
  descMeasure: { position: 'absolute', opacity: 0, zIndex: -1, left: spacing.l, right: spacing.l },
  reviewsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m },
  reviewsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s, flexWrap: 'wrap' },
  reviewsRating: { fontSize: 26, fontFamily: fontFamily.extrabold },
  stars: { color: colors.accent, fontSize: fontSize.l },
  reviewsCount: { fontSize: fontSize.s },
  reviewRow: { marginBottom: spacing.s },
  reviewAuthor: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  reviewText: { fontSize: fontSize.s, marginTop: 2 },
  reviewsEmpty: { fontSize: fontSize.s, marginBottom: spacing.s },
  recRow: { marginHorizontal: -spacing.l, paddingHorizontal: spacing.l },
  recCard: { width: 160, marginRight: spacing.m },
  recPoster: { width: 160, height: 160 * (4 / 3), borderRadius: radius.m, backgroundColor: colors.surface2, overflow: 'hidden', marginBottom: spacing.s },
  recTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s, lineHeight: 17 },
  recVenue: { fontSize: fontSize.xs, marginTop: 2 },
  recPrice: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.xs, marginTop: 2 },
});
