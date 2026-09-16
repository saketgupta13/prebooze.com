import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Ported from prebooze-web/src/components/Accordion.tsx. */
export default function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.head} onPress={() => setOpen((o) => !o)}>
        <Txt style={styles.title}>{title}</Txt>
        <ChevronDown size={16} color={colors.muted} style={open ? styles.chevOpen : undefined} />
      </Pressable>
      {open && <Muted style={styles.body}>{children}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: colors.border3, borderRadius: radius.m, marginBottom: spacing.m, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.m },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  chevOpen: { transform: [{ rotate: '180deg' }] },
  body: { paddingHorizontal: spacing.m, paddingBottom: spacing.m, fontSize: fontSize.s, lineHeight: 19 },
});
