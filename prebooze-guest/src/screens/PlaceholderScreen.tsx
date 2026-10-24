import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { IconButton, Muted, Screen, Txt } from '../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Placeholder for a screen already fully designed (see the design canvas)
 * but not yet wired to real data — Day 1 scaffolding prioritized the core
 * follow → push → book loop; this keeps navigation functional everywhere
 * else while the rest gets built out incrementally. */
export default function PlaceholderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>{route.name}</Txt>
      </View>
      <View style={styles.body}>
        <Muted style={styles.text}>This screen is designed and coming soon.</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  text: { textAlign: 'center' },
});
