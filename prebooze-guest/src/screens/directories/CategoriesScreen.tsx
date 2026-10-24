import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const [cats, setCats] = useState<{ name: string; icon: string; subs: string[] }[] | null>(null);

  useEffect(() => {
    catalog.categories().then(setCats).catch(() => setCats([]));
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Categories</Txt>
      </View>

      {!cats && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      <ScrollView contentContainerStyle={styles.grid}>
        {(cats ?? []).map((c) => (
          <Pressable key={c.name} style={styles.card} onPress={() => navigation.navigate('Browse', { cat: c.name })}>
            <Txt style={styles.catIcon}>{c.icon}</Txt>
            <Txt style={styles.catName}>{c.name}</Txt>
            {c.subs.length > 0 && <Muted style={styles.catSubs}>{c.subs.slice(0, 3).join(', ')}</Muted>}
          </Pressable>
        ))}
        {cats?.length === 0 && <Muted style={{ padding: spacing.l }}>No categories available.</Muted>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, padding: spacing.l, paddingTop: 0 },
  card: { width: '47%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l },
  catIcon: { fontSize: 24, marginBottom: spacing.s },
  catName: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: 4 },
  catSubs: { fontSize: fontSize.xs },
});
