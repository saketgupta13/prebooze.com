import { Children, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Txt } from './ui';
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';

const STEP = 220;

/** Horizontal card slider with an optional title sharing one header row
 * with the scroll arrows — same single-row pattern as SliderSection.tsx
 * ("Top organizers" etc), not a title row followed by a separate arrow row
 * (that looked like a stray floating button with nothing else on its
 * line). Arrows live in that header, never beside the card row itself, so
 * they never sit next to whichever card happens to be peeking at the edge. */
export default function HSlider({ title, children }: { title?: string; children: ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const offsetX = useRef(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    offsetX.current = contentOffset.x;
    setAtStart(contentOffset.x <= 4);
    setAtEnd(contentOffset.x >= contentSize.width - layoutMeasurement.width - 4);
  };

  // Arrows only earn their place once there's real content to scroll to —
  // with 3 or fewer cards, the row can look like it's scrolled to the edge
  // from layout rounding alone even though there's nothing more to see, so
  // a raw atStart/atEnd check alone isn't enough; gate on a real item
  // count too.
  const showArrows = Children.count(children) > 3 && (!atStart || !atEnd);

  return (
    <View>
      {(!!title || showArrows) && (
        <View style={styles.hd}>
          {!!title && <Txt style={styles.title} numberOfLines={1}>{title}</Txt>}
          {showArrows && (
            <View style={styles.arrowRow}>
              {!atStart && (
                <Pressable style={styles.arrow} onPress={() => ref.current?.scrollTo({ x: Math.max(0, offsetX.current - STEP), animated: true })}>
                  <ChevronLeft size={14} color="#fff" />
                </Pressable>
              )}
              {!atEnd && (
                <Pressable style={styles.arrow} onPress={() => ref.current?.scrollTo({ x: offsetX.current + STEP, animated: true })}>
                  <ChevronRight size={14} color="#fff" />
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
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
  hd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.s },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold, flexShrink: 1 },
  arrowRow: { flexDirection: 'row', gap: 8 },
  arrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 12, paddingRight: 12 },
});
