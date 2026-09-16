import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Music } from 'lucide-react-native';
import { colors, radius } from '../theme/tokens';

/** Ported from prebooze-web/src/components/Poster.tsx — a real photo when
 * `imageUrl` is set, else a branded placeholder block. Web's radial-
 * gradient placeholder becomes a flat `hsl()` tint here (RN's style parser
 * accepts hsl() strings, but not multi-stop gradients without an extra
 * dependency) — same hue-driven per-event variety, simpler render. */
export default function Poster({ hue, icon, imageUrl, alt }: { hue: number; icon?: ReactNode; imageUrl?: string | null; alt?: string }) {
  if (imageUrl) {
    return (
      <View style={styles.wrap}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={alt} />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, styles.placeholder, { backgroundColor: `hsl(${hue}, 45%, 16%)` }]}>
      {icon ?? <Music size={40} color={colors.muted2} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 0.7, borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.surface2 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
