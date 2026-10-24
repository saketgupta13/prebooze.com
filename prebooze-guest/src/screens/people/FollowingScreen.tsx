import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { social } from '../../api/social';
import { catalog } from '../../api/catalog';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Organizer, Person } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'Following'; params: RootStackParamList['Following'] };

export default function FollowingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const [tab, setTab] = useState<'followers' | 'following'>(route.params?.initialTab ?? 'following');
  const [followers, setFollowers] = useState<Person[] | null>(null);
  const [orgs, setOrgs] = useState<Organizer[] | null>(null);

  useFocusEffect(useCallback(() => {
    social.followers().then(setFollowers).catch(() => setFollowers([]));
    social.mySocialState().then(async (s) => {
      // Scoped to followed organizers (bare, unprefixed ids in `following`)
      // — same subset web's own Profile.tsx "Following" card shows;
      // venue/lineup/promoter/person follows are reachable from their own
      // directories instead of duplicated here.
      const orgIds = s.following.filter((k) => !k.includes(':'));
      const resolved = await Promise.all(orgIds.map((id) => catalog.organizer(id).catch(() => null)));
      setOrgs(resolved.filter((o): o is Organizer => !!o));
    }).catch(() => setOrgs([]));
  }, []));

  const loading = tab === 'followers' ? followers === null : orgs === null;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'following' && styles.tabActive]} onPress={() => setTab('following')}>
          <Txt style={[styles.tabLabel, tab === 'following' && styles.tabLabelActive]}>Following{orgs ? ` · ${orgs.length}` : ''}</Txt>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'followers' && styles.tabActive]} onPress={() => setTab('followers')}>
          <Txt style={[styles.tabLabel, tab === 'followers' && styles.tabLabelActive]}>Followers{followers ? ` · ${followers.length}` : ''}</Txt>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {!loading && tab === 'following' && (
        <ScrollView contentContainerStyle={styles.list}>
          {orgs!.length === 0 && <Muted style={styles.empty}>Follow organizers to see their next events first.</Muted>}
          {orgs!.map((o) => (
            <Pressable key={o.id} style={styles.row} onPress={() => navigation.navigate('OrganizerProfile', { id: o.id })}>
              <View style={[styles.avatar, { backgroundColor: `hsl(${o.logoHue} 55% 40%)` }]}>
                {o.logoUrl ? <Image source={{ uri: o.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Txt style={styles.avatarLetter}>{o.brandName[0]}</Txt>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Txt style={styles.name} numberOfLines={1}>{o.brandName}</Txt>
                  {o.verified && <BadgeCheck size={13} color={colors.accent} />}
                </View>
                <Muted style={styles.meta}>{o.city}</Muted>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!loading && tab === 'followers' && (
        <ScrollView contentContainerStyle={styles.list}>
          {followers!.length === 0 && <Muted style={styles.empty}>No followers yet.</Muted>}
          {followers!.map((p) => (
            <Pressable key={p.id} style={styles.row} onPress={() => navigation.navigate('PersonProfile', { username: p.username })}>
              {p.avatarUrl ? (
                <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: `hsl(${p.avatarHue} 55% 40%)`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Txt style={styles.avatarLetter}>{p.name[0]}</Txt>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Txt style={styles.name} numberOfLines={1}>{p.name}</Txt>
                  {p.verified && <BadgeCheck size={13} color={colors.accent} />}
                </View>
                <Muted style={styles.meta}>{p.city}</Muted>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, paddingTop: spacing.s },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: spacing.s, marginHorizontal: spacing.l },
  tab: { flex: 1, alignItems: 'center', paddingBottom: spacing.m },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabLabel: { fontSize: fontSize.s, color: colors.muted, fontFamily: fontFamily.medium },
  tabLabelActive: { color: colors.text, fontFamily: fontFamily.bold },
  list: { padding: spacing.l },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.s },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.m },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  meta: { fontSize: fontSize.xs },
});
