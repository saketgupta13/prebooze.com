import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, X } from 'lucide-react-native';
import { notifications } from '../../api/notifications';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';
import type { DashboardStackParamList } from '../../navigation/types';
import type { OrgNotification } from '../../types';

/** New for this app (2026-09-16) — web's organizer console has never had a
 * notification bell/inbox at all (its own Settings.tsx explicitly dropped a
 * fake "notification prefs" toggle that had no real backend behind it). This
 * is genuinely new product surface, not a port: a real in-app inbox backed
 * by OrgNotification rows, raised so far only when admin approves/rejects
 * an event (see organizer.service.ts's adminApprove/adminReject) — more
 * trigger points (new booking, payout processed, etc.) can call the same
 * OrgNotificationsService.notify() later without any new screen work. */
export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const [rows, setRows] = useState<OrgNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      notifications
        .list()
        .then((rs) => { if (!cancelled) setRows(rs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load notifications'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const unreadCount = rows.filter((r) => !r.read).length;

  const markRead = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)));
    notifications.markRead(id).catch(() => {});
  };

  const markAllRead = () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    notifications.markAllRead().catch(() => {});
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Notifications</H1>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead}>
            <Txt style={styles.link}>Mark all read</Txt>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Card style={styles.listCard}>
          {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
          {!loading && rows.length === 0 && <Muted style={styles.centerNote}>Nothing here yet — you'll see updates like event approvals here.</Muted>}
          {rows.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => !n.read && markRead(n.id)}
              style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            >
              <Txt style={styles.icon}>{n.icon}</Txt>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={n.read ? styles.text : styles.textUnread}>{n.text}</Txt>
                <Muted style={styles.tiny}>{timeAgo(n.createdAt)}</Muted>
              </View>
              {!n.read && <View style={styles.dot} />}
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Matches Dashboard's H1 top offset/font size (see other stack screens).
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  link: { color: colors.accent, fontSize: fontSize.s, fontFamily: fontFamily.bold },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  listCard: { padding: spacing.l },
  centerNote: { textAlign: 'center', padding: spacing.l },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  icon: { fontSize: 18 },
  text: { fontSize: fontSize.s, color: colors.muted },
  textUnread: { fontSize: fontSize.s, fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4 },
});
