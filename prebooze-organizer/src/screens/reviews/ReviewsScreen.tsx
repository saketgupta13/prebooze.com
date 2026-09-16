import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Star, User, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { social } from '../../api/social';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Kpi, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { GuestReview } from '../../types';

/** Faithful port of prebooze-web/src/pages/organizer/OrgReviews.tsx —
 * read-only, same GET /organizers/:id/reviews. Moderation lives in the
 * admin panel only; no edit/delete/flag action exists here on web either. */
export default function ReviewsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .me()
        .then((me) => social.organizerReviews(me.id))
        .then((rs) => { if (!cancelled) setReviews(rs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load reviews'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const fiveStarPct = reviews.length ? Math.round((reviews.filter((r) => r.rating === 5).length / reviews.length) * 100) : 0;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Reviews</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>
          what guests said after your events — reviews are moderated by Prebooze and can't be edited or removed by organizers
        </Muted>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {reviews.length > 0 && (
          <View style={styles.kpiGrid}>
            <Kpi label="Average rating" value={avg.toFixed(1)} />
            <Kpi label="Total reviews" value={String(reviews.length)} />
            <Kpi label="5-star share" value={`${fiveStarPct}%`} tone="accent" />
          </View>
        )}

        <Card style={styles.listCard}>
          {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
          {!loading && reviews.length === 0 && <Muted style={styles.centerNote}>No reviews yet.</Muted>}
          {reviews.map((r, i) => (
            <View key={r.id} style={[styles.row, i < reviews.length - 1 && styles.rowBorder]}>
              <View style={styles.avatar}><User size={16} color={colors.muted} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowHead}>
                  <Txt style={styles.bold}>{r.author}</Txt>
                  <Stars rating={r.rating} />
                </View>
                <Muted style={styles.tiny}>{r.eventTitle ? `${r.eventTitle} · ` : ''}{r.date}</Muted>
                <Txt style={styles.reviewText}>{r.text}</Txt>
              </View>
            </View>
          ))}
        </Card>

        <Muted style={styles.footerNote}>
          think a review breaks the guidelines? flag it and the Prebooze team will look — moderation happens in the admin panel
        </Muted>
      </ScrollView>
    </Screen>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} color={colors.accent} fill={i < rating ? colors.accent : 'none'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches Dashboard's H1 top offset/font size (see other MoreStack screens).
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  kpiGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  listCard: { padding: spacing.l },
  centerNote: { textAlign: 'center', padding: spacing.l },
  row: { flexDirection: 'row', gap: spacing.m, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  stars: { flexDirection: 'row', gap: 2 },
  tiny: { fontSize: 11.5, marginTop: 2 },
  reviewText: { marginTop: spacing.s, fontSize: fontSize.s },
  footerNote: { fontSize: 11, marginTop: spacing.m },
});
