import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play } from 'lucide-react-native';
import { Txt } from './ui';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';
import type { CmsReel } from '../api/content';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Poster-first, tap-to-play — the real video only starts downloading once
 * a guest taps it, not the instant the Home feed loads. Mirrors web's
 * ReelCard.tsx exactly (same real admin-managed Reel rows, same UX).
 *
 * bookUrl is set only for a paid organizer/venue reel tied to a real event
 * (see api/content.ts's CmsReel) — renders a "Book now" button right below
 * it, navigating to that event; omitted entirely for an ordinary admin-
 * created reel with no event behind it, same as before this existed. */
export default function ReelCard({ reel }: { reel: CmsReel }) {
  const [playing, setPlaying] = useState(false);
  const navigation = useNavigation<Nav>();

  const card = !reel.videoUrl ? (
    <View style={[styles.card, { backgroundColor: `hsl(${reel.hue} 45% 24%)` }]}>
      <Txt style={styles.placeholderTxt} numberOfLines={2}>{reel.title}</Txt>
    </View>
  ) : playing ? (
    <PlayingReel videoUrl={reel.videoUrl} title={reel.title} />
  ) : (
    <Pressable style={styles.card} onPress={() => setPlaying(true)}>
      {reel.posterUrl ? <Image source={{ uri: reel.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: `hsl(${reel.hue} 45% 24%)` }]} />}
      <View style={styles.playBtn}>
        <Play size={18} color="#fff" fill="#fff" />
      </View>
    </Pressable>
  );

  if (!reel.bookUrl) return card;

  // Admin's CTA-link shape only ever offers web routes — only the
  // event-page shape (/<city-slug>/events/<slug>) has a real RN screen to
  // land on, same reasoning as the hero banner's own identical parsing.
  const eventSlug = /^\/[^/]+\/events\/([^/]+)/.exec(reel.bookUrl)?.[1];
  return (
    <View style={{ width: 110 }}>
      {card}
      {eventSlug && (
        <Pressable style={styles.bookBtn} onPress={() => navigation.navigate('EventDetail', { slug: eventSlug })}>
          <Txt style={styles.bookBtnTxt}>Book now →</Txt>
        </Pressable>
      )}
    </View>
  );
}

function PlayingReel({ videoUrl, title }: { videoUrl: string; title: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView style={styles.card} player={player} contentFit="cover" nativeControls={false} accessibilityLabel={title} />;
}

const styles = StyleSheet.create({
  card: { width: 110, height: 190, borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  placeholderTxt: { textAlign: 'center', paddingHorizontal: 10, fontFamily: fontFamily.medium, fontSize: 12 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,21,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  bookBtn: { marginTop: spacing.xs, backgroundColor: colors.accent, borderRadius: radius.s, paddingVertical: 6, alignItems: 'center' },
  bookBtnTxt: { fontSize: 11.5, fontFamily: fontFamily.bold, color: colors.onAccent },
});
