import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { BadgeCheck, CheckCircle2, ChevronRight, Gift } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { social } from '../../api/social';
import { bookingsApi } from '../../api/bookings';
import { htmlToPlainText } from '../../lib/richtext';
import { Button, Card, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACCOUNT_ROWS: { label: string; to: keyof RootStackParamList }[] = [
  { label: 'Edit profile', to: 'EditProfile' },
  { label: 'Followers & Following', to: 'Following' },
  { label: 'Wishlist & favourites', to: 'Wishlist' },
  { label: 'Wallet', to: 'Wallet' },
  { label: 'Refer & earn', to: 'ReferEarn' },
  { label: 'Payment methods', to: 'PaymentMethods' },
];

const GENERAL_ROWS: { label: string; to: keyof RootStackParamList }[] = [
  { label: 'Notifications', to: 'NotificationSettings' },
  { label: 'Help center', to: 'HelpCenter' },
  { label: 'Privacy policy', to: 'PrivacyPolicy' },
  { label: 'About Prebooze', to: 'AboutPrebooze' },
];

const VIS_OPTIONS: { v: 'off' | 'followers' | 'public'; label: string; desc: string }[] = [
  { v: 'off', label: 'Off', desc: 'Nobody sees you' },
  { v: 'followers', label: 'Followers', desc: 'People who follow you' },
  { v: 'public', label: 'Public', desc: 'Anyone on Prebooze' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [attendedCount, setAttendedCount] = useState(0);

  useFocusEffect(useCallback(() => {
    social.followers().then((f) => setFollowerCount(f.length)).catch(() => {});
    social.mySocialState().then((s) => setFollowingCount(s.following.filter((k) => k.startsWith('person:')).length)).catch(() => {});
    bookingsApi.list().then((list) => {
      const now = Date.now();
      setAttendedCount(list.filter((b) => b.status === 'confirmed' && b.event && new Date(b.event.date).getTime() <= now).length);
    }).catch(() => {});
  }, []));

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch (e) {
            Alert.alert('Could not log out', e instanceof ApiError ? e.message : 'Something went wrong — try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, [logout]);

  if (!user) return null;

  const visibility = user.attendanceVisibility ?? 'off';
  const bio = htmlToPlainText(user.bio ?? '').trim();

  const setVisibility = async (v: 'off' | 'followers' | 'public') => {
    await social.setAttendanceVisibility(v).catch(() => {});
    await refreshUser();
  };
  const toggleDiscoverable = async () => {
    await social.setDiscoverable(!user.discoverable).catch(() => {});
    await refreshUser();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Txt style={styles.h1}>Profile</Txt>

        <View style={styles.avatarRow}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Txt style={styles.avatarLetter}>{user.name?.[0]?.toUpperCase() ?? '?'}</Txt>
            </View>
          )}
          <View style={styles.nameRow}>
            <Txt style={styles.name}>{user.name || 'New guest'}</Txt>
            {user.idVerified && <BadgeCheck size={16} color={colors.accent} />}
          </View>
          <Muted style={styles.meta}>{user.username ? `@${user.username} · ` : ''}{user.city}</Muted>
          {!!bio && <Muted style={styles.bio}>{bio}</Muted>}
        </View>

        {/* Boxed 3-up stat grid — same .stat3/.statBox pattern as the
            Organizer/Venue/Person profile screens (bordered surface boxes),
            instead of this screen's own plain-text stat row + a separate
            redundant "N followers · N following" line above it. */}
        <View style={styles.stat3}>
          <View style={styles.statBox}><Txt style={styles.statVal}>{attendedCount}</Txt><Muted style={styles.statLabel}>attended</Muted></View>
          <View style={styles.statBox}><Txt style={styles.statVal}>{followerCount}</Txt><Muted style={styles.statLabel}>followers</Muted></View>
          <View style={styles.statBox}><Txt style={styles.statVal}>{followingCount}</Txt><Muted style={styles.statLabel}>following</Muted></View>
        </View>

        <Card style={styles.verifyCard}>
          <Txt style={styles.cardTitle}>Verification status</Txt>
          <View style={styles.kvRow}>
            <Muted>Phone number</Muted>
            <View style={styles.badgeOk}><Txt style={styles.badgeOkTxt}>Verified</Txt><CheckCircle2 size={12} color={colors.accent} /></View>
          </View>
          <View style={styles.kvRow}>
            <Muted>Government ID</Muted>
            {user.idVerified ? (
              <View style={styles.badgeOk}><Txt style={styles.badgeOkTxt}>Verified</Txt><CheckCircle2 size={12} color={colors.accent} /></View>
            ) : (
              <View style={styles.badgePending}><Txt style={styles.badgePendingTxt}>Paused</Txt></View>
            )}
          </View>
          <View style={styles.kvRow}>
            <Muted>Profile status</Muted>
            <Txt style={styles.kvVal}>{user.profilePct}% complete</Txt>
          </View>
          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Muted>Joined</Muted>
            <Txt style={styles.kvVal}>{user.joined}</Txt>
          </View>
        </Card>

        {!user.profileRewardClaimedAt && (
          <Card style={styles.rewardCard}>
            <View style={styles.rewardTitleRow}>
              <Gift size={16} color={colors.text} />
              <Txt style={styles.cardTitle}>Get 10% off your next booking</Txt>
            </View>
            <Muted style={styles.rewardDesc}>Finish your profile — photo, bio, interests — and get a one-time 10% off code (up to ₹100).</Muted>
            <Button label="Complete your profile →" onPress={() => navigation.navigate('FinishProfile')} style={{ alignSelf: 'flex-start', marginTop: spacing.s }} />
          </Card>
        )}

        <Card style={styles.visCard}>
          <Txt style={styles.cardTitle}>Who's going — privacy</Txt>
          <Muted style={styles.visDesc}>Choose who can see the events you're attending. Off by default.</Muted>
          {VIS_OPTIONS.map((o) => {
            const cur = visibility === o.v;
            return (
              <Pressable key={o.v} style={[styles.visBtn, cur && styles.visBtnOn]} onPress={() => setVisibility(o.v)}>
                <View style={styles.visBtnLeft}>
                  {cur && <CheckCircle2 size={13} color={cur ? colors.onAccent : colors.text} />}
                  <Txt style={[styles.visBtnLabel, cur && styles.visBtnLabelOn]}>{o.label}</Txt>
                </View>
                <Txt style={[styles.visBtnDesc, cur && styles.visBtnLabelOn]}>{o.desc}</Txt>
              </Pressable>
            );
          })}
        </Card>

        <Card style={styles.visCard}>
          <Txt style={styles.cardTitle}>People directory</Txt>
          <Muted style={styles.visDesc}>Let other guests discover your profile in People and "Going out in {user.city}".</Muted>
          <Pressable style={[styles.visBtn, user.discoverable && styles.visBtnOn]} onPress={toggleDiscoverable}>
            <View style={styles.visBtnLeft}>
              {!!user.discoverable && <CheckCircle2 size={13} color={colors.onAccent} />}
              <Txt style={[styles.visBtnLabel, user.discoverable && styles.visBtnLabelOn]}>Show me in the People directory</Txt>
            </View>
            <Txt style={[styles.visBtnDesc, user.discoverable && styles.visBtnLabelOn]}>{user.discoverable ? 'On' : 'Off'}</Txt>
          </Pressable>
        </Card>

        <Txt style={styles.sectionLabel}>MY ACCOUNT</Txt>
        <Card style={styles.rowsCard}>
          {ACCOUNT_ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              onPress={() => navigation.navigate(row.to as never)}
              style={[styles.row, i === ACCOUNT_ROWS.length - 1 && styles.rowLast]}
            >
              <Txt style={styles.rowLabel}>{row.label}</Txt>
              <ChevronRight size={16} color={colors.muted2} />
            </Pressable>
          ))}
        </Card>

        <Txt style={styles.sectionLabel}>GENERAL</Txt>
        <Card style={styles.rowsCard}>
          {GENERAL_ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              onPress={() => navigation.navigate(row.to as never)}
              style={[styles.row, i === GENERAL_ROWS.length - 1 && styles.rowLast]}
            >
              <Txt style={styles.rowLabel}>{row.label}</Txt>
              <ChevronRight size={16} color={colors.muted2} />
            </Pressable>
          ))}
        </Card>

        <Button label={loggingOut ? 'Logging out…' : 'Log out'} variant="danger" loading={loggingOut} onPress={confirmLogout} style={styles.logoutBtn} />
        <Button label="Delete account" variant="ghost" onPress={() => navigation.navigate('DeleteAccount')} style={styles.deleteBtn} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginBottom: spacing.m },
  avatarRow: { alignItems: 'center', marginBottom: spacing.l },
  avatar: { width: 76, height: 76, borderRadius: 38, marginBottom: spacing.s, overflow: 'hidden' },
  avatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.onAccent, fontFamily: fontFamily.extrabold, fontSize: 28 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl },
  meta: { fontSize: fontSize.s, marginTop: 2 },
  bio: { fontSize: fontSize.s, textAlign: 'center', marginTop: spacing.s, paddingHorizontal: spacing.l },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  verifyCard: { marginBottom: spacing.m },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border },
  kvVal: { fontSize: fontSize.s },
  badgeOk: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(155,225,61,0.12)', borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOkTxt: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  badgePending: { backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 3 },
  badgePendingTxt: { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  rewardCard: { marginBottom: spacing.m, borderColor: colors.accent },
  rewardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  rewardDesc: { fontSize: fontSize.xs },
  sectionLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.muted, marginBottom: spacing.s, marginTop: spacing.m },
  rowsCard: { padding: 0, marginBottom: spacing.m, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, paddingHorizontal: spacing.l, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: fontSize.m },
  visCard: { marginBottom: spacing.m },
  visDesc: { fontSize: fontSize.xs, marginBottom: spacing.s },
  visBtn: { borderWidth: 1, borderColor: colors.border2, borderRadius: radius.m, paddingVertical: spacing.s, paddingHorizontal: spacing.m, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  visBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visBtnLabel: { fontSize: fontSize.s, fontFamily: fontFamily.medium },
  visBtnLabelOn: { color: colors.onAccent },
  visBtnDesc: { fontSize: fontSize.xs, color: colors.muted },
  stat3: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.m, alignItems: 'center' },
  statVal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.l },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  logoutBtn: { marginTop: spacing.l },
  deleteBtn: { marginTop: spacing.s },
});
