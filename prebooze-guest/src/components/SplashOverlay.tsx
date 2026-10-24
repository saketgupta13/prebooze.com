import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

const GLOW_W = 320;
const GLOW_H = 180;

/** Branded loading screen shown while AuthContext resolves the boot check —
 * ported from prebooze-organizer's SplashOverlay (pulsing radial glow
 * behind the logo), without the "PARTNERS" caption since this is the
 * guest-facing app. */
export default function SplashOverlay() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim: ReturnType<typeof Animated.loop> | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      );
      anim.start();
    });
    return () => anim?.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glowWrap, { transform: [{ scale }], opacity }]}>
        <Svg width={GLOW_W} height={GLOW_H}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.38} />
              <Stop offset="45%" stopColor={colors.accent} stopOpacity={0.14} />
              <Stop offset="75%" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={GLOW_W / 2} cy={GLOW_H / 2} rx={GLOW_W / 2} ry={GLOW_H / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      {/* elevation forces this onto its own paint layer — same Android
          stacking fix the organizer app needed for its SplashOverlay. */}
      <View style={styles.foreground}>
        <Image source={require('../assets/logo-full.png')} style={styles.logo} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  glowWrap: { position: 'absolute' },
  foreground: { alignItems: 'center', elevation: 1 },
  logo: { width: 260, height: 260 * (192 / 946) },
});
