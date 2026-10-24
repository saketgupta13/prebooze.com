import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Muted, Screen } from '../../components/ui';
import { colors, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same pattern as PrivacyPolicyScreen — opens the real, single-source-of-
// truth About page on prebooze.com instead of duplicating marketing copy
// in the app, where it would silently drift out of date.
export default function AboutPrebozeScreen() {
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    WebBrowser.openBrowserAsync('https://prebooze.com/about').finally(() => navigation.goBack());
  }, [navigation]);

  return (
    <Screen style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Muted style={{ marginTop: spacing.m }}>Opening about Prebooze…</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
