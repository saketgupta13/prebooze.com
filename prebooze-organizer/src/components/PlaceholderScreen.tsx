import { StyleSheet, View } from 'react-native';
import { H2, Muted, Screen } from './ui';
import { spacing } from '../theme/tokens';

/** Stand-in for screens not yet built in the current phase — swapped out
 * screen-by-screen as each phase lands, never left in place once real
 * content exists. */
export default function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <Screen style={styles.screen}>
      <H2>{title}</H2>
      <Muted style={styles.note}>{note}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  note: { marginTop: spacing.s, textAlign: 'center' },
});
