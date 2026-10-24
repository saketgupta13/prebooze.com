import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { social } from '../../api/social';
import { catalog } from '../../api/catalog';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, Venue } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WishlistScreen() {
  const navigation = useNavigation<Nav>();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);

  const load = useCallback(async () => {
    try {
      const social_ = await social.mySocialState();
      // The public catalog only looks events up by slug, not id, and
      // wishlist/favourite store real ids — no batch-by-id endpoint either
      // (venue lookup by id does exist). Resolve venues directly; for
      // events, pull the full catalog once and match ids client-side —
      // a guest's own saved list is small, so this is an acceptable cost
      // for a real (not mocked) screen.
      const [allEvents, vns] = await Promise.all([
        social_.wishlist.length ? catalog.events({}) : Promise.resolve([]),
        Promise.all(social_.favouriteVenues.map((id) => catalog.venue(id).catch(() => null))),
      ]);
      const wishlistSet = new Set(social_.wishlist);
      setEvents(allEvents.filter((e) => wishlistSet.has(e.id)));
      setVenues(vns.filter((v): v is Venue => !!v));
    } catch {
      setEvents([]);
      setVenues([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loading = events === null || venues === null;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>My wishlist</Txt>
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {!loading && (
        <ScrollView contentContainerStyle={styles.content}>
          <Txt style={styles.sectionLabel}>Saved events ({events!.length})</Txt>
          {events!.length === 0 && <Muted style={styles.empty}>Tap the heart on any event to save it here.</Muted>}
          {events!.map((ev) => (
            <Pressable key={ev.id} style={styles.row} onPress={() => navigation.navigate('EventDetail', { slug: ev.slug })}>
              <View style={styles.rowPoster}>{ev.posterUrl && <Image source={{ uri: ev.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={styles.rowTitle} numberOfLines={2}>{ev.title}</Txt>
                <Muted style={styles.rowMeta}>{new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Muted>
              </View>
              <Heart size={18} color={colors.accent} fill={colors.accent} />
            </Pressable>
          ))}

          <Txt style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Favourite venues ({venues!.length})</Txt>
          {venues!.length === 0 && <Muted style={styles.empty}>Tap the heart on any venue to save it here.</Muted>}
          {venues!.map((v) => (
            <Pressable key={v.id} style={styles.row} onPress={() => navigation.navigate('VenueProfile', { id: v.id })}>
              <View style={[styles.avatar, { backgroundColor: `hsl(${v.photoHue} 55% 40%)` }]}>
                {v.logoUrl ? <Image source={{ uri: v.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.avatarLetter}>{v.name[0]}</Txt>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={styles.rowTitle} numberOfLines={1}>{v.name}</Txt>
                <Muted style={styles.rowMeta}>{v.city}</Muted>
              </View>
              <Heart size={18} color={colors.accent} fill={colors.accent} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  empty: { fontSize: fontSize.s, marginBottom: spacing.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m, marginBottom: spacing.s },
  rowPoster: { width: 56, height: 56, borderRadius: radius.m, backgroundColor: colors.surface2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLetter: { color: '#fff', fontFamily: fontFamily.bold },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  rowMeta: { fontSize: fontSize.xs },
});
