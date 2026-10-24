import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Flame, MapPin, Megaphone, Search, ShoppingCart, X } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { content, type CmsBanner, type CmsReel, type PlatformInfo } from '../../api/content';
import SocialIcon, { type SocialPlatform } from '../../components/SocialIcon';
import { social } from '../../api/social';
import { haptics } from '../../lib/haptics';
import { useCity } from '../../context/CityContext';
import { getResumeCart, type ResumeCart } from '../../lib/cartTracker';
import { getRecentlyViewed } from '../../lib/recentlyViewed';
import CityPickerModal from '../../components/CityPickerModal';
import CategoryIcon from '../../components/CategoryIcon';
import DirectoryCard from '../../components/DirectoryCard';
import VenueCard from '../../components/VenueCard';
import EventGridCard from '../../components/EventGridCard';
import HSlider from '../../components/HSlider';
import SliderSection from '../../components/SliderSection';
import FaqAccordion from '../../components/FaqAccordion';
import ReelCard from '../../components/ReelCard';
import { Button, Chip, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, LineupProfile, Organizer, Person, PromoterProfile, Venue } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same slides as prebooze-web's Home.tsx HERO constant (minus the
// role-signup slide — organizer/venue onboarding isn't a guest-app flow).
const HERO = [
  { hue: 95, emoji: '🎉', badge: 'Featured', title: "Your city's events, one tap away", text: 'Concerts, comedy, festivals and warehouse parties — instant tickets, QR entry, zero fakes.' },
  { hue: 285, emoji: '📣', badge: 'Guest lists', title: 'Free entry before the cutoff', text: "Join a promoter's guest list and walk in free — no ticket needed if you're early." },
  { hue: 200, emoji: '👀', badge: "Who's going", title: "See who's going before you book", text: 'Follow your friends and spot the crowd on every event in your city.' },
  { hue: 330, emoji: '🎧', badge: 'Line-ups', title: 'Catch your favourite acts live', text: 'Follow DJs, bands and comedians — never miss their next set.' },
];

// Same static FAQS as prebooze-web's Home.tsx (data/mock.ts), trimmed to
// guest-facing questions only — web's list also includes two
// organizer-side entries (verification/payouts) that make no sense in a
// guest-only app with no organizer surface at all.
const FAQS = [
  { q: 'How do I get my ticket?', a: 'Sent instantly to your WhatsApp — also downloadable as QR from My Bookings.' },
  { q: 'Can I cancel a booking?', a: 'Yes — free cancellation up to 48 hours before the event. Refunds land back on your payment method instantly.' },
  { q: 'Do I need an account to book?', a: 'You log in with your WhatsApp number and an OTP — no passwords, no forms. Your number is your account.' },
];

// Admin only ever types "instagram.com/prebooze"-style handles, not always
// the full "https://…" — same normalization as web's Footer.tsx withScheme,
// since a bare domain passed straight to Linking.openURL fails outright.
const withScheme = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
const SOCIAL_KEYS: { key: keyof PlatformInfo['socials']; platform: SocialPlatform }[] = [
  { key: 'instagram', platform: 'instagram' },
  { key: 'facebook', platform: 'facebook' },
  { key: 'x', platform: 'x' },
  { key: 'youtube', platform: 'youtube' },
  { key: 'whatsapp', platform: 'whatsapp' },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { city, setCity } = useCity();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Tomorrow' | 'This week' | 'This month'>('All');
  const [err, setErr] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<{ name: string; icon: string; subs: string[] }[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[] | null>(null);
  const [promoters, setPromoters] = useState<PromoterProfile[] | null>(null);
  const [lineups, setLineups] = useState<LineupProfile[] | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [reels, setReels] = useState<CmsReel[]>([]);
  // Real, admin-managed hero banners — same source as prebooze-web's Home.tsx
  // (Admin > Content > Banners). HERO above stays only as the fallback for
  // before any real "Live" banner exists. null = not fetched yet.
  const [liveBannersRaw, setLiveBannersRaw] = useState<CmsBanner[] | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [socials, setSocials] = useState<PlatformInfo['socials']>({});
  const [resumeCart, setResumeCart] = useState<ResumeCart | null>(null);
  const [resumeCartDismissed, setResumeCartDismissed] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<Event[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await catalog.events({ city });
      setEvents(data);
      setErr('');
    } catch {
      setErr("Couldn't load events — pull to refresh");
    }
    social.mySocialState().then((s) => {
      setWishlist(new Set(s.wishlist));
      setFollowing(new Set(s.following));
    }).catch(() => {});
    catalog.categories().then(setCategories).catch(() => setCategories([]));
    catalog.organizers(city).then(setOrganizers).catch(() => setOrganizers([]));
    catalog.promoters(city).then(setPromoters).catch(() => setPromoters([]));
    catalog.lineups(city).then(setLineups).catch(() => setLineups([]));
    catalog.venues(city).then(setVenues).catch(() => setVenues([]));
    catalog.people(city).then(setPeople).catch(() => setPeople([]));
    content.reels(city).then(setReels).catch(() => setReels([]));
    content.banners(city).then(setLiveBannersRaw).catch(() => setLiveBannersRaw([]));
    getResumeCart().then(setResumeCart).catch(() => {});
    content.settings().then((s) => setSocials(s.socials ?? {})).catch(() => {});
  }, [city]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Refreshed on every focus (not just mount) — the list only ever changes
  // by viewing an Event Detail screen and coming back here, so a plain
  // mount-only load would always show whatever was recorded before this
  // visit to Home, missing the event the guest just looked at.
  useFocusEffect(useCallback(() => {
    getRecentlyViewed().then(setRecentlyViewed).catch(() => {});
  }, []));

  // Nothing told a guest to check the inbox before — a plain bell icon with
  // no unread signal (fixed elsewhere this round: it now opens a real
  // feed, but opening it is still something the guest has to think to do).
  useFocusEffect(useCallback(() => {
    social.unreadNotificationCount().then((r) => setHasUnreadNotifications(r.count > 0)).catch(() => {});
  }, []));

  // A banner with no image can't render the real hero (needs a 16:5
  // background photo) — one real production row (seeded before the admin
  // editor required an image upload) has imageUrl: null, so without this
  // filter the hero would show up blank the moment this deploys, not a
  // graceful fallback to HERO.
  const liveBanners = useMemo(() => (liveBannersRaw ?? []).filter((b) => b.imageUrl), [liveBannersRaw]);
  const usingRealBanners = liveBanners.length > 0;
  const heroSlideCount = usingRealBanners ? liveBanners.length : HERO.length;

  // Auto-advance the hero every 5s, same as web.
  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroSlideCount), 5000);
    return () => clearInterval(t);
  }, [heroSlideCount]);

  const toggleWishlist = (eventId: string) => {
    const was = wishlist.has(eventId);
    setWishlist((s) => { const next = new Set(s); was ? next.delete(eventId) : next.add(eventId); return next; });
    haptics.tap();
    social.wishlist(eventId, !was).catch(() => {
      setWishlist((s) => { const next = new Set(s); was ? next.add(eventId) : next.delete(eventId); return next; });
    });
  };

  const toggleFollow = (key: string) => {
    const was = following.has(key);
    setFollowing((s) => { const next = new Set(s); was ? next.delete(key) : next.add(key); return next; });
    (was ? social.unfollow(key) : social.follow(key)).catch(() => {
      setFollowing((s) => { const next = new Set(s); was ? next.add(key) : next.delete(key); return next; });
    });
  };

  // The shared Button component is sized for full-width primary actions
  // (50dp tall, large label) — inside a 190dp DirectoryCard that dwarfed
  // the card. A small dedicated pill instead, same visual states.
  const followBtn = (key: string) => {
    const isFollowing = following.has(key);
    return (
      <Pressable style={[styles.followPill, isFollowing && styles.followPillGhost]} onPress={() => toggleFollow(key)}>
        <Txt style={[styles.followPillTxt, isFollowing && styles.followPillTxtGhost]}>{isFollowing ? 'Following ✓' : '+ Follow'}</Txt>
      </Pressable>
    );
  };

  const sectionHeader = (title: string, onSeeAll?: () => void) => (
    <View style={styles.sectionHd}>
      <Txt style={styles.sectionTitle}>{title}</Txt>
      {!!onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Txt style={styles.seeAll}>See all →</Txt>
        </Pressable>
      )}
    </View>
  );

  const safeHeroIdx = heroIdx % heroSlideCount;
  const h = HERO[safeHeroIdx];
  const categoryTiles = categories
    .map((c) => ({ ...c, n: (events ?? []).filter((e) => e.category === c.name).length }))
    .filter((c) => c.n > 0);

  // Today/Tomorrow/This week/This month — replaces a category chip row
  // that duplicated the category tiles above it with a date-range filter
  // instead, same job web's own sort/filter options do but tuned to what's
  // actually useful on a short "what's on" list rather than a long browse.
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

  // "Top selling" — ranked by total tickets sold (desc), same as web's
  // Home.tsx (`soldOf`), not just the backend's default date-ascending
  // order.
  const soldOf = (e: Event) => e.tiers.reduce((a, t) => a + t.sold, 0);
  const topSelling = [...dateScoped].sort((a, b) => soldOf(b) - soldOf(a));

  return (
    <Screen>
      <View style={styles.header}>
        <Image source={require('../../assets/logo-full.png')} style={styles.headerLogo} contentFit="contain" />
        <View style={styles.headerRight}>
          {/* Real bug: this had no onPress at all — pure decoration. A real
              in-app notification feed now exists (GuestNotification rows,
              raised on new-event-from-followed and followed-person-going
              pushes), so this opens that feed directly instead of settings. */}
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Bell size={16} color={colors.text} />
            {hasUnreadNotifications && <View style={styles.unreadDot} />}
          </Pressable>
          <Pressable style={styles.cityPill} onPress={() => setPickerOpen(true)}>
            <MapPin size={13} color={colors.muted} />
            <Txt style={styles.cityTxt}>{city}</Txt>
            <ChevronDown size={12} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.searchBar} onPress={() => navigation.navigate('Browse', undefined)}>
        <Search size={16} color={colors.muted} />
        <Muted style={styles.searchPlaceholder}>Search events, venues, organizers, artists...</Muted>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Resume checkout — device-local nudge (see lib/cartTracker.ts),
            same purpose as web's resume-cart card: pick up a checkout the
            guest started but didn't finish. */}
        {!!resumeCart && !resumeCartDismissed && (
          <View style={styles.resumeCard}>
            <Pressable style={styles.resumeDismiss} onPress={() => setResumeCartDismissed(true)} hitSlop={8}>
              <X size={15} color={colors.muted} />
            </Pressable>
            <View style={styles.resumeRow}>
              <View style={styles.resumeIcon}><ShoppingCart size={18} color={colors.accent} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={styles.resumeTitle} numberOfLines={1}>You left {resumeCart.ticketCount} ticket{resumeCart.ticketCount > 1 ? 's' : ''} for {resumeCart.eventTitle}</Txt>
                <Muted style={styles.resumeSub} numberOfLines={1}>Finish before they sell out · {resumeCart.tierSummary} · ₹{resumeCart.total}</Muted>
              </View>
            </View>
            <Button
              label="Resume checkout →"
              onPress={() => navigation.navigate('Checkout', { eventSlug: resumeCart.eventSlug, qty: resumeCart.qty })}
              style={{ marginTop: spacing.m }}
            />
          </View>
        )}

        {/* Hero slider — real, admin-managed banners when any are live
            (same source as prebooze-web's Home.tsx); HERO above is only the
            offline/dev-mode and "no real banner created yet" fallback. */}
        <View style={styles.hero}>
          {usingRealBanners ? (() => {
            const b = liveBanners[safeHeroIdx];
            // Admin's CTA-link picker only ever offers web routes (an event
            // page, /browse, /host, a CMS page) — only the event-page shape
            // has a real RN screen to land on; anything else just isn't
            // tappable here rather than opening a dead/web-only route.
            const eventSlug = b.ctaLink ? /^\/events\/([^/]+)/.exec(b.ctaLink)?.[1] : undefined;
            const Wrapper = eventSlug ? Pressable : View;
            return (
              <Wrapper
                style={styles.heroBg}
                {...(eventSlug ? { onPress: () => navigation.navigate('EventDetail', { slug: eventSlug }) } : {})}
              >
                {b.imageUrl && <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                <View style={[StyleSheet.absoluteFill, styles.heroImageScrim]} />
                <Txt style={styles.heroTitle}>{b.heading}</Txt>
                {!!b.description && <Muted style={styles.heroText}>{b.description}</Muted>}
              </Wrapper>
            );
          })() : (
            <View style={[styles.heroBg, { backgroundColor: `hsl(${h.hue} 45% 24%)` }]}>
              <View style={styles.heroBadge}><Txt style={styles.heroBadgeTxt}>{h.emoji} {h.badge} · {city}</Txt></View>
              <Txt style={styles.heroTitle}>{h.title}</Txt>
              <Muted style={styles.heroText}>{h.text}</Muted>
            </View>
          )}
          <Pressable style={[styles.heroArrow, styles.heroArrowLeft]} onPress={() => setHeroIdx((i) => (i - 1 + heroSlideCount) % heroSlideCount)}>
            <ChevronLeft size={18} color="#fff" />
          </Pressable>
          <Pressable style={[styles.heroArrow, styles.heroArrowRight]} onPress={() => setHeroIdx((i) => (i + 1) % heroSlideCount)}>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
          <View style={styles.heroDots}>
            {Array.from({ length: heroSlideCount }, (_, i) => (
              <Pressable key={i} onPress={() => setHeroIdx(i)}>
                <View style={[styles.heroDot, i === safeHeroIdx && styles.heroDotOn]} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Category tiles with icon + live per-category event counts. */}
        {categoryTiles.length > 0 && (
          <View style={styles.catTilesWrap}>
            <HSlider title={`Top categories in ${city}`}>
              {categoryTiles.map((c) => (
                <Pressable key={c.name} style={styles.catTile} onPress={() => navigation.navigate('Browse', { city, cat: c.name })}>
                  <CategoryIcon name={c.name} size={22} color={colors.accent} />
                  <Txt style={styles.catTileName} numberOfLines={1}>{c.name}</Txt>
                  <Muted style={styles.catTileCount}>{c.n} event{c.n === 1 ? '' : 's'}</Muted>
                </Pressable>
              ))}
            </HSlider>
          </View>
        )}

        {/* Small clickable banners, not the full grid-card size used
            elsewhere — this is a quick "pick up where you left off" strip,
            not another full browsing grid competing with the real one
            below it. */}
        {recentlyViewed.length > 0 && (
          <View style={[styles.section, styles.recentSection]}>
            <SliderSection title="Recently viewed">
              {recentlyViewed.map((ev) => (
                <Pressable key={ev.id} style={styles.recentBanner} onPress={() => navigation.navigate('EventDetail', { slug: ev.slug })}>
                  <View style={[styles.recentBannerThumb, { backgroundColor: `hsl(${ev.posterHue} 45% 24%)` }]}>
                    {ev.posterUrl && <Image source={{ uri: ev.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                  </View>
                  <Txt style={styles.recentBannerTitle} numberOfLines={1}>{ev.title}</Txt>
                </Pressable>
              ))}
            </SliderSection>
          </View>
        )}

        {sectionHeader(`Top selling events in ${city}`, () => navigation.navigate('Browse', { city }))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(['All', 'Today', 'Tomorrow', 'This week', 'This month'] as const).map((c) => (
            <Chip key={c} label={c} active={dateFilter === c} onPress={() => setDateFilter(c)} />
          ))}
        </ScrollView>

        {!events && !err && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}
        {!!err && <Muted style={{ marginTop: spacing.l, textAlign: 'center' }}>{err}</Muted>}

        {events && (
          <View style={styles.grid}>
            {topSelling.length === 0 && <Muted style={{ marginTop: spacing.l }}>No events in {city} yet.</Muted>}
            {topSelling.map((ev) => (
              <EventGridCard
                key={ev.id}
                event={ev}
                isPast={false}
                onPress={() => navigation.navigate('EventDetail', { slug: ev.slug })}
                favorited={wishlist.has(ev.id)}
                onToggleFavorite={() => toggleWishlist(ev.id)}
              />
            ))}
          </View>
        )}

        {/* Going out in {city} — real, opt-in guests only (discoverable).
            One card: avatar stack + copy + a small inline CTA that wraps
            below on narrow widths, same as web's flex-wrap card — not a
            separate full-width button underneath it. */}
        {!!people && people.length > 0 && (
          <View style={styles.section}>
            {/* Single card: avatar stack + copy + a small inline CTA that
                wraps below on narrow widths — same flex-wrap row as web,
                not a separate full-width button under a separate card. */}
            <View style={styles.peopleBanner}>
              <View style={styles.peopleStack}>
                {people.slice(0, 6).map((p) => (
                  <View key={p.id} style={[styles.peopleAvatar, { backgroundColor: `hsl(${p.avatarHue} 55% 45%)` }]}>
                    {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.peopleAvatarTxt}>{p.name[0]}</Txt>}
                  </View>
                ))}
              </View>
              <View style={styles.peopleBannerCopy}>
                <Txt style={styles.peopleBannerTitle}>{people.length}+ people going out in {city}</Txt>
                <Muted style={styles.peopleBannerSub}>Follow them to see which parties they're hitting — before the tickets go.</Muted>
              </View>
              <Pressable style={styles.peopleCta} onPress={() => navigation.navigate('Main', { screen: 'People' })}>
                <Txt style={styles.peopleCtaTxt}>Find your people →</Txt>
              </Pressable>
            </View>
            <SliderSection
              title={`Going out in ${city}`}
              icon={<Flame size={16} color={colors.accent} />}
              onSeeAll={() => navigation.navigate('Main', { screen: 'People' })}
            >
              {people.map((p) => (
                <DirectoryCard
                  key={p.id}
                  onPress={() => navigation.navigate('PersonProfile', { username: p.username })}
                  hue={p.avatarHue}
                  avatarText={p.name[0]}
                  avatarImage={p.avatarUrl}
                  name={p.name}
                  verified={p.verified}
                  meta={`@${p.username} · ${p.city}`}
                  stats={`${p.followers} followers · ${p.going.length} going`}
                  action={followBtn(`person:${p.id}`)}
                />
              ))}
            </SliderSection>
          </View>
        )}

        {reels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Txt style={styles.sectionTitle}>Things happening at events</Txt>
              <Clapperboard size={16} color={colors.text} />
            </View>
            <HSlider>
              {reels.map((r) => <ReelCard key={r.id} reel={r} />)}
            </HSlider>
          </View>
        )}

        {!!organizers && organizers.length > 0 && (
          <View style={styles.section}>
            <SliderSection title={`Top organizers in ${city}`} onSeeAll={() => navigation.navigate('OrganizersDirectory')}>
              {organizers.slice(0, 10).map((o) => (
                <DirectoryCard
                  key={o.id}
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
              ))}
            </SliderSection>
          </View>
        )}

        {!!promoters && promoters.length > 0 && (
          <View style={styles.section}>
            <SliderSection title={`Top promoters in ${city}`} icon={<Megaphone size={16} color={colors.text} />} onSeeAll={() => navigation.navigate('PromotersDirectory')}>
              {promoters.slice(0, 10).map((p) => (
                <DirectoryCard
                  key={p.slug}
                  onPress={() => navigation.navigate('PromoterProfile', { slug: p.slug })}
                  hue={p.hue}
                  avatarText="📣"
                  avatarImage={p.logoUrl}
                  name={p.name}
                  verified={p.verified}
                  meta={`${p.city} · ${p.followers} followers`}
                  stats={`${p.showRate}% show-rate · ${p.guestsBrought} brought`}
                  action={followBtn(`promoter:${p.slug}`)}
                />
              ))}
            </SliderSection>
          </View>
        )}

        {!!lineups && lineups.length > 0 && (
          <View style={styles.section}>
            <SliderSection title={`Top line-ups in ${city}`} onSeeAll={() => navigation.navigate('LineupsDirectory')}>
              {lineups.slice(0, 10).map((l) => (
                <DirectoryCard
                  key={l.slug}
                  onPress={() => navigation.navigate('LineupProfile', { slug: l.slug })}
                  hue={l.hue}
                  avatarText={l.emoji || l.name[0]}
                  avatarImage={l.logoUrl}
                  name={l.name}
                  verified={l.verified}
                  meta={`${l.category} · ${l.city}`}
                  stats={`${l.followers} followers · ${l.eventsPlayed} shows`}
                  action={followBtn(`lineup:${l.slug}`)}
                />
              ))}
            </SliderSection>
          </View>
        )}

        {!!venues && venues.length > 0 && (
          <View style={styles.section}>
            <SliderSection title={`Top venues in ${city}`} onSeeAll={() => navigation.navigate('VenuesDirectory')}>
              {venues.slice(0, 10).map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  eventCount={v.eventsHosted}
                  onPress={() => navigation.navigate('VenueProfile', { id: v.id })}
                  action={followBtn(`venue:${v.id}`)}
                />
              ))}
            </SliderSection>
          </View>
        )}


        {/* FAQs */}
        <View style={styles.section}>
          <Txt style={styles.sectionTitle}>FAQs</Txt>
          <View style={{ marginTop: spacing.s }}>
            {FAQS.map((f, i) => (
              <FaqAccordion key={f.q} question={f.q} answer={f.a} defaultOpen={i === 0} />
            ))}
          </View>
        </View>

        {/* Footer — kept minimal: an app user doesn't need the web's
            marketing links, just legal essentials. */}
        <View style={styles.footer}>
          <Image source={require('../../assets/logo-full.png')} style={styles.footerLogo} contentFit="contain" />
          {SOCIAL_KEYS.some((s) => !!socials[s.key]?.trim()) && (
            <View style={styles.footerSocialRow}>
              {SOCIAL_KEYS.filter((s) => !!socials[s.key]?.trim()).map((s) => (
                <Pressable key={s.key} style={styles.footerSocialBtn} onPress={() => Linking.openURL(withScheme(socials[s.key]!))}>
                  <SocialIcon platform={s.platform} size={17} color={colors.text} />
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.footerLinks}>
            {/* Real bug: now that the app is a verified Android App Links
                handler for all of prebooze.com (so shared profile/event
                links open in-app instead of a browser), a plain
                Linking.openURL('https://prebooze.com/...') from inside the
                app resolves right back to this same app instead of a
                browser — the OS just silently no-ops since these paths
                have no matching route in linking.ts. WebBrowser.
                openBrowserAsync forces a real Chrome Custom Tab instead,
                same fix PrivacyPolicyScreen already uses. */}
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://prebooze.com/legal/terms')}><Muted style={styles.footerLink}>Terms</Muted></Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://prebooze.com/legal/privacy')}><Muted style={styles.footerLink}>Privacy</Muted></Pressable>
          </View>
          <Muted style={styles.footerCopy}>© {new Date().getFullYear()} Prebooze. All rights reserved.</Muted>
        </View>
      </ScrollView>

      {/* Sticky "continue browsing" bar — the single most recently viewed
          event, pinned above the tab bar (this View's own bottom:0 already
          lands exactly at the tab bar's top edge; the tab bar is a sibling
          layer in the bottom-tab navigator, not inside this screen, so no
          extra inset math is needed here). Only the event detail is one
          tap away, not a skip-straight-to-payment shortcut — ticket tiers/
          pricing can change between viewing and booking, so this always
          re-opens Event Detail rather than caching a stale price. */}
      {recentlyViewed.length > 0 && (
        <Pressable
          style={styles.recentBar}
          onPress={() => navigation.navigate('EventDetail', { slug: recentlyViewed[0].slug })}
        >
          <View style={[styles.recentBarThumb, { backgroundColor: `hsl(${recentlyViewed[0].posterHue} 45% 24%)` }]}>
            {recentlyViewed[0].posterUrl && <Image source={{ uri: recentlyViewed[0].posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Muted style={styles.recentBarLabel}>Continue browsing</Muted>
            <Txt style={styles.recentBarTitle} numberOfLines={1}>{recentlyViewed[0].title}</Txt>
          </View>
          <View style={styles.recentBarBtn}>
            <Txt style={styles.recentBarBtnTxt}>Book</Txt>
          </View>
        </Pressable>
      )}

      <CityPickerModal visible={pickerOpen} currentCity={city} onClose={() => setPickerOpen(false)} onSelect={setCity} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Real bug: `section`'s own marginTop only pushes space above it — the
  // next sibling (`sectionHeader`'s "Top selling events" title) isn't
  // wrapped in its own `section` View here, so nothing pushed it away
  // from the banners above. A bottom margin on this section specifically
  // (not a global `section` change, which other sections already look
  // correct without) fixes it without touching anywhere else.
  // marginTop:0 overrides `section`'s own — catTilesWrap right above this
  // already supplies marginBottom: spacing.xl, so stacking `section`'s own
  // marginTop: spacing.xl on top doubled the gap above "Recently viewed"
  // to 40 while every other section elsewhere only ever gets the normal
  // single 20.
  recentSection: { marginTop: 0, marginBottom: spacing.l },
  recentBanner: { width: 150 },
  recentBannerThumb: { width: 150, height: 84, borderRadius: radius.m, overflow: 'hidden' },
  recentBannerTitle: { fontSize: fontSize.xs, fontFamily: fontFamily.medium, marginTop: 6 },
  recentBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.l, paddingTop: 15, paddingBottom: 15,
  },
  recentBarThumb: { width: 38, height: 38, borderRadius: radius.s, overflow: 'hidden' },
  recentBarLabel: { fontSize: 10.5 },
  recentBarTitle: { fontSize: fontSize.s, fontFamily: fontFamily.bold, marginTop: 1 },
  recentBarBtn: { backgroundColor: colors.accent, borderRadius: radius.m, paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  recentBarBtnTxt: { fontSize: fontSize.s, fontFamily: fontFamily.bold, color: colors.onAccent },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.l, paddingTop: spacing.s },
  headerLogo: { width: 140, height: 28 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.bg,
  },
  cityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: spacing.m, paddingVertical: 7,
  },
  cityTxt: { fontSize: fontSize.s, fontFamily: fontFamily.medium },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.m, paddingHorizontal: spacing.l, paddingVertical: spacing.m, marginHorizontal: spacing.l, marginTop: spacing.s,
  },
  searchPlaceholder: { fontSize: fontSize.m },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { height: 190, borderRadius: radius.l, overflow: 'hidden', marginBottom: spacing.l },
  heroBg: { flex: 1, padding: spacing.l, justifyContent: 'center', overflow: 'hidden' },
  heroImageScrim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: spacing.s, paddingVertical: 4, marginBottom: spacing.s },
  heroBadgeTxt: { fontSize: 10.5, fontFamily: fontFamily.bold, color: colors.onAccent },
  heroTitle: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginBottom: 6 },
  heroText: { fontSize: fontSize.s },
  // Arrows sit in the bottom corners, level with the dots, rather than
  // vertically centered over the headline where they covered the text.
  heroArrow: { position: 'absolute', bottom: spacing.s, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(20,21,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  heroArrowLeft: { left: spacing.s },
  heroArrowRight: { right: spacing.s },
  heroDots: { position: 'absolute', bottom: spacing.s, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  heroDotOn: { backgroundColor: colors.accent, width: 16 },
  catTilesWrap: { marginBottom: spacing.xl },
  catTile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.m, minWidth: 120, gap: 4, alignItems: 'center' },
  catTileName: { fontSize: fontSize.s, fontFamily: fontFamily.bold, marginTop: 2, textAlign: 'center' },
  catTileCount: { fontSize: fontSize.xs, textAlign: 'center' },
  sectionTitle: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  sectionHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s },
  seeAll: { fontSize: fontSize.s, color: colors.accent, fontFamily: fontFamily.medium },
  chipRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l, paddingRight: spacing.l },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, justifyContent: 'space-between' },
  section: { marginTop: spacing.xl },
  followPill: { height: 30, borderRadius: radius.s, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.s },
  followPillGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  followPillTxt: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  followPillTxtGhost: { color: colors.text },
  peopleBanner: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m, marginBottom: spacing.m },
  peopleStack: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.m },
  peopleAvatar: { flex: 1, aspectRatio: 1, borderRadius: 999, marginHorizontal: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: colors.bg },
  peopleAvatarTxt: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.l },
  peopleBannerCopy: { marginBottom: spacing.m },
  peopleBannerTitle: { fontSize: fontSize.m, fontFamily: fontFamily.bold },
  peopleBannerSub: { fontSize: fontSize.xs, marginTop: 2 },
  // Compact inline CTA — same btn-sm sizing as web (6/12 padding, 13px
  // text), not the shared 50dp-tall full-width Button.
  peopleCta: { backgroundColor: colors.accent, borderRadius: radius.s, paddingVertical: spacing.s, alignItems: 'center' },
  peopleCtaTxt: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.onAccent },
  resumeCard: { backgroundColor: 'rgba(155,225,61,0.06)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.l, padding: spacing.m, marginBottom: spacing.l },
  resumeDismiss: { position: 'absolute', top: spacing.s, right: spacing.s, zIndex: 1 },
  resumeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m, paddingRight: spacing.l },
  resumeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { fontSize: fontSize.s, fontFamily: fontFamily.bold },
  resumeSub: { fontSize: fontSize.xs, marginTop: 2 },
  footer: { marginTop: spacing.xxl, paddingTop: spacing.l, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerLogo: { width: 130, height: 26, marginBottom: spacing.l },
  footerSocialRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  footerSocialBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border3, alignItems: 'center', justifyContent: 'center' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, justifyContent: 'center' },
  footerLink: { fontSize: fontSize.s },
  footerCopy: { fontSize: fontSize.xs, marginTop: spacing.l },
});
