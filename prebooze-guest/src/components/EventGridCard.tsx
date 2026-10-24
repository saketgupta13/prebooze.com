import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Muted, Txt } from './ui';
import FavoriteHeart from './FavoriteHeart';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';
import { isSoldOut } from '../lib/eventStatus';
import type { Event } from '../types';

/** Grid card for a profile's upcoming/past event lists and the Home feed —
 * full, uncropped 3:4 poster (matches prebooze-web's EventCard.tsx `Poster`
 * sizing, not a cropped square thumbnail) plus a Book now/Sold out pill,
 * same as web. Wishlist heart is rendered here (not by the caller) so it
 * overlays the poster correctly regardless of what wraps this card. */
export default function EventGridCard({
  event, isPast, onPress, favorited, onToggleFavorite,
}: {
  event: Event;
  isPast: boolean;
  onPress: () => void;
  favorited?: boolean;
  onToggleFavorite?: () => void;
}) {
  const soldOut = isSoldOut(event, isPast);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.poster}>
        {event.posterUrl ? <Image source={{ uri: event.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {!!onToggleFavorite && <FavoriteHeart active={!!favorited} onToggle={onToggleFavorite} />}
      </View>
      <View style={styles.body}>
        <Txt style={styles.title} numberOfLines={2}>{event.title}</Txt>
        <Muted style={styles.date}>{new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Muted>
        <View style={styles.footer}>
          <Txt style={styles.price}>{event.minPrice ? `From ₹${event.minPrice}` : 'Free'}</Txt>
          <View style={[styles.pill, soldOut ? styles.pillGhost : styles.pillPri]}>
            <Txt style={[styles.pillTxt, soldOut && styles.pillTxtGhost]}>{soldOut ? 'Sold out' : 'Book now'}</Txt>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, overflow: 'hidden', marginBottom: spacing.m },
  poster: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface2 },
  body: { padding: spacing.m },
  title: { fontSize: fontSize.s, fontFamily: fontFamily.bold, marginBottom: 4, minHeight: 32 },
  date: { fontSize: fontSize.xs, marginBottom: spacing.s },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  price: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.accent },
  pill: { paddingHorizontal: spacing.s, paddingVertical: 5, borderRadius: radius.s },
  pillPri: { backgroundColor: colors.accent },
  pillGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  pillTxt: { fontSize: 10.5, fontFamily: fontFamily.bold, color: colors.onAccent },
  pillTxtGhost: { color: colors.muted },
});
