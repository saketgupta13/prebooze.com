import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { PenLine, Star } from 'lucide-react-native';
import { socialReviews, type OrgReview, type VenueReview } from '../api/social';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Guest-facing rating + review list + write-a-review form for organizer/
 * venue profiles — mirrors prebooze-web's ReviewsSection.tsx 1:1 against the
 * same real GET/POST /organizers|venues/:id/reviews endpoints. */
export default function ReviewsSection({
  targetType,
  targetId,
  prompt,
}: {
  targetType: 'organizer' | 'venue';
  targetId: string;
  prompt: string;
}) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<(OrgReview | VenueReview)[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const fetcher = targetType === 'venue' ? socialReviews.venue : socialReviews.organizer;
    fetcher(targetId).then(setReviews).catch(() => setReviews([]));
  }, [targetType, targetId]);

  const all = reviews ?? [];
  const avg = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0;

  const submit = async () => {
    if (!user) return Alert.alert('Log in to write a review');
    if (!rating || !text.trim()) return;
    setPosting(true);
    try {
      const created = targetType === 'venue'
        ? await socialReviews.addVenueReview(targetId, rating, text.trim())
        : await socialReviews.addOrganizerReview(targetId, rating, text.trim());
      setReviews((prev) => [created, ...(prev ?? [])]);
      setFormOpen(false);
      setRating(0);
      setText('');
    } catch (e) {
      Alert.alert('Could not post review', e instanceof ApiError ? e.message : 'Try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.section}>
      <Txt style={styles.sectionLabel}>Rating & reviews</Txt>
      <View style={styles.card}>
        <View style={styles.avgRow}>
          {all.length > 0 ? (
            <>
              <Txt style={styles.avgVal}>{avg.toFixed(1)}</Txt>
              <StarRow rating={avg} size={15} />
              <Muted style={styles.avgCount}>· {all.length} review{all.length === 1 ? '' : 's'}</Muted>
            </>
          ) : (
            <Muted>No reviews yet — be the first</Muted>
          )}
        </View>

        {!formOpen ? (
          <Pressable style={styles.writeBtn} onPress={() => setFormOpen(true)}>
            <PenLine size={13} color={colors.accent} />
            <Txt style={styles.writeBtnTxt}>Write a review</Txt>
          </Pressable>
        ) : (
          <View style={styles.form}>
            <View style={styles.starPickRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Star size={24} color={n <= rating ? colors.accent : colors.muted} fill={n <= rating ? colors.accent : 'transparent'} />
                </Pressable>
              ))}
              <Muted style={styles.ratingTxt}>{rating ? `${rating}/5` : 'pick a rating'}</Muted>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={prompt}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.input}
            />
            <View style={styles.formBtns}>
              <Button label={posting ? 'Posting…' : 'Post review'} loading={posting} disabled={!rating || !text.trim() || posting} onPress={submit} style={{ flex: 1 }} />
              <Button label="Cancel" variant="ghost" onPress={() => setFormOpen(false)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {all.map((r) => (
          <View key={r.id} style={styles.review}>
            <View style={styles.reviewHead}>
              <Txt style={styles.reviewAuthor}>{r.author}</Txt>
              <StarRow rating={r.rating} size={11} />
              <Muted style={styles.reviewDate}>{'eventTitle' in r && r.eventTitle ? `${r.eventTitle} · ${r.date}` : r.date}</Muted>
            </View>
            <Muted style={styles.reviewTxt}>"{r.text}"</Muted>
          </View>
        ))}
        {all.length === 0 && <Muted style={styles.empty}>No reviews yet.</Muted>}
      </View>
    </View>
  );
}

function StarRow({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} color={colors.accent} fill={n <= Math.round(rating) ? colors.accent : 'transparent'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.m },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.m },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  avgVal: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  avgCount: {},
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.m },
  writeBtnTxt: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: fontSize.s },
  form: { marginBottom: spacing.m, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.m, padding: spacing.m },
  starPickRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  ratingTxt: { marginLeft: spacing.s, fontSize: fontSize.xs },
  input: { minHeight: 70, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.s, backgroundColor: colors.surface2, borderRadius: radius.s, padding: spacing.s, marginBottom: spacing.s, textAlignVertical: 'top' },
  formBtns: { flexDirection: 'row', gap: spacing.s },
  review: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.s, marginTop: spacing.s },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  reviewAuthor: { fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  reviewDate: { fontSize: fontSize.xs },
  reviewTxt: { fontSize: fontSize.s, lineHeight: 18 },
  empty: { fontSize: fontSize.xs },
});
