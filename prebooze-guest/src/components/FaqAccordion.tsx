import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';

export default function FaqAccordion({ question, answer, defaultOpen }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Pressable style={styles.row} onPress={() => setOpen((o) => !o)}>
      <View style={styles.head}>
        <Txt style={styles.q}>{question}</Txt>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={16} color={colors.muted} />
        </View>
      </View>
      {open && <Muted style={styles.a}>{answer}</Muted>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.m },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  q: { flex: 1, fontSize: fontSize.s, fontFamily: fontFamily.bold },
  a: { marginTop: spacing.s, fontSize: fontSize.s, lineHeight: 19 },
});
