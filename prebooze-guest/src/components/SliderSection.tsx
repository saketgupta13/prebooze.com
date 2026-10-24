import { Children, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

const STEP = 220;

/** A horizontal card slider with its title, "See all" link and scroll
 * arrows all living in one header row above the cards — the arrows used to
 * float beside the card row itself and ended up sitting on top of
 * whichever card was peeking at the edge. Keeping them in the header
 * guarantees they never touch a card. */
export default function SliderSection({
  title, icon, onSeeAll, children,
}: {
  title: string;
  icon?: ReactNode;
  onSeeAll?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<ScrollView>(null);
  const offsetX = useRef(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  // Same reasoning as HSlider.tsx's own fix — with 3 or fewer cards there's
  // nothing real to scroll to, so arrows never earn their place regardless
  // of what the raw atStart/atEnd scroll measurement happens to read.
  const hasOverflow = Children.count(children) > 3;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    offsetX.current = contentOffset.x;
    setAtStart(contentOffset.x <= 4);
    setAtEnd(contentOffset.x >= contentSize.width - layoutMeasurement.width - 4);
  };

  return (
    <View>
      <View style={styles.hd}>
        <View style={styles.titleRow}>
          <Txt style={styles.title} numberOfLines={1}>{title}</Txt>
          {icon}
        </View>
        <View style={styles.hdRight}>
          {!!onSeeAll && (
            <Pressable onPress={onSeeAll}>
              <Txt style={styles.seeAll}>See all →</Txt>
            </Pressable>
          )}
          {hasOverflow && !atStart && (
            <Pressable style={styles.arrow} onPress={() => ref.current?.scrollTo({ x: Math.max(0, offsetX.current - STEP), animated: true })}>
              <ChevronLeft size={14} color="#fff" />
            </Pressable>
          )}
          {hasOverflow && !atEnd && (
            <Pressable style={styles.arrow} onPress={() => ref.current?.scrollTo({ x: offsetX.current + STEP, animated: true })}>
              <ChevronRight size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onContentSizeChange={(w) => setAtEnd(w <= 390)}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.s, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold, flexShrink: 1 },
  hdRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  seeAll: { fontSize: fontSize.s, color: colors.accent, fontFamily: fontFamily.medium },
  arrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 12, paddingRight: 24 },
});
