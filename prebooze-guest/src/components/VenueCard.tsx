import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BadgeCheck, Star } from 'lucide-react-native';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';
import type { Venue } from '../types';

/** Venue card — a real landscape gallery photo (same as prebooze-web's
 * Home.tsx, which uses v.galleryUrls[0], not a round logo avatar like the
 * other directory cards), with the venue's logo as a small overlay badge.
 * Used both on Home's "Top venues" slider (fixed 220dp width) and the full
 * Venues directory screen (2-up grid, via the `style` override). */
export default function VenueCard({
  venue, eventCount, onPress, style, action, featured,
}: {
  venue: Venue; eventCount: number; onPress: () => void; style?: StyleProp<ViewStyle>; action?: ReactNode; featured?: boolean;
}) {
  const photo = venue.galleryUrls?.[0];
  return (
    <Pressable style={[styles.card, featured && styles.cardFeatured, style]} onPress={onPress}>
      <View style={[styles.photo, { backgroundColor: `hsl(${venue.photoHue} 45% 24%)` }]}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {!!venue.logoUrl && (
          <View style={styles.logoBadge}>
            <Image source={{ uri: venue.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        )}
        {featured && (
          <View style={styles.featuredBadge}>
            <Star size={9} color={colors.onAccent} fill={colors.onAccent} />
            <Txt style={styles.featuredTxt}>Featured</Txt>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Txt style={styles.name} numberOfLines={1}>{venue.name}</Txt>
          {venue.verified && <BadgeCheck size={13} color={colors.accent} />}
        </View>
        <Muted style={styles.meta} numberOfLines={1}>★ {venue.rating} · {eventCount} event{eventCount === 1 ? '' : 's'} · {venue.type}</Muted>
        {!!action && <View style={styles.actionWrap}>{action}</View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 220, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, overflow: 'hidden' },
  cardFeatured: { borderColor: colors.accent },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  logoBadge: { position: 'absolute', left: spacing.s, bottom: -16, width: 34, height: 34, borderRadius: radius.s, overflow: 'hidden', borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.surface2 },
  featuredBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  featuredTxt: { fontSize: 9, fontFamily: fontFamily.bold, color: colors.onAccent },
  body: { padding: spacing.m, paddingTop: spacing.m + 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: fontSize.s, fontFamily: fontFamily.bold, flexShrink: 1 },
  meta: { fontSize: 10.5, marginTop: 4 },
  actionWrap: { marginTop: spacing.s },
});
