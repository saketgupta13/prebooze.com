import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from './ui';
import { catalog } from '../api/catalog';
import { spacing } from '../theme/tokens';

/** Real, admin-managed event categories — same source EditProfile/
 * FinishProfile use on web (GET /categories), not a hardcoded tag list. */
export default function InterestsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    catalog.categories().then((cats) => setTags(cats.map((c) => c.name))).catch(() => setTags([]));
  }, []);

  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);

  return (
    <View style={styles.row}>
      {tags.map((t) => (
        <Chip key={t} label={t} active={value.includes(t)} onPress={() => toggle(t)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
});
