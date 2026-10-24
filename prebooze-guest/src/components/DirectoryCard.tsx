import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BadgeCheck, Star } from 'lucide-react-native';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Consistent directory card for people/organizers/promoters/line-ups — used
 * both on the Home screen's horizontal "Top X in {city}" sliders (fixed
 * 190dp width) and on each role's full directory list screen (2-up grid,
 * via the `style` override) — mirrors web's DirectoryCard.tsx (plain card,
 * avatar, bio, stats, action) in both places. */
export default function DirectoryCard({
  onPress, hue, avatarText, avatarImage, name, verified, meta, bio, stats, action, featured, style,
}: {
  onPress: () => void;
  hue: number;
  avatarText: string;
  avatarImage?: string | null;
  name: string;
  verified?: boolean;
  meta: string;
  bio?: string;
  stats?: ReactNode;
  action?: ReactNode;
  featured?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, featured && styles.cardFeatured, style]}>
      {featured && (
        <View style={styles.featuredBadge}>
          <Star size={9} color={colors.onAccent} fill={colors.onAccent} />
          <Txt style={styles.featuredTxt}>Featured</Txt>
        </View>
      )}
      <Pressable onPress={onPress}>
        <View style={[styles.avatar, { backgroundColor: `hsl(${hue} 55% 45%)` }]}>
          {avatarImage ? <Image source={{ uri: avatarImage }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.avatarTxt}>{avatarText}</Txt>}
        </View>
      </Pressable>
      <Pressable onPress={onPress}>
        <View style={styles.nameRow}>
          <Txt style={styles.name} numberOfLines={1}>{name}</Txt>
          {verified && <BadgeCheck size={13} color={colors.accent} />}
        </View>
      </Pressable>
      <Muted style={styles.meta} numberOfLines={1}>{meta}</Muted>
      {!!bio && <Muted style={styles.bio} numberOfLines={2}>{bio}</Muted>}
      {!!stats && <Muted style={styles.stats} numberOfLines={1}>{stats}</Muted>}
      {!!action && <View style={styles.actionWrap}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 190, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m },
  cardFeatured: { borderColor: colors.accent },
  featuredBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  featuredTxt: { fontSize: 9, fontFamily: fontFamily.bold, color: colors.onAccent },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.s },
  avatarTxt: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.m },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: fontSize.s, fontFamily: fontFamily.bold, flexShrink: 1 },
  meta: { fontSize: 10.5, marginTop: 2 },
  bio: { fontSize: 10.5, marginTop: spacing.s, lineHeight: 14 },
  stats: { fontSize: 10.5, marginTop: spacing.s },
  actionWrap: { marginTop: spacing.m },
});
