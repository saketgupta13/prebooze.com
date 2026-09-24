import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Banknote, CheckCircle2, RotateCcw, ShieldCheck, ShoppingCart, Star, Ticket, XCircle, ArrowLeft, X, type LucideIcon } from 'lucide-react-native';
import { notifications } from '../../api/notifications';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';
import { navigateToNotificationTarget } from '../../lib/notificationNav';
import type { DashboardStackParamList, MainTabParamList } from '../../navigation/types';
import type { OrgNotification } from '../../types';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

// Mirrors the backend's KIND_EMOJI map (org-notifications.ts) — the `icon`
// field is a short kind slug, not a raw emoji, so the panel can render a
// real vector icon consistent with the rest of the app instead of a text
// glyph (organizer feedback 2026-09-16). A slug with no match here still
// renders something reasonable via the Bell-style fallback below.
// Same rgba background convention as ui.tsx's Badge tones (badgeSuccess/
// badgeDanger/badgeAccent) — kept literal here rather than imported since
// those are tone-name-keyed, not kind-slug-keyed.
const KIND_ICON: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  approved: { Icon: CheckCircle2, color: colors.success, bg: 'rgba(31,138,91,0.16)' },
  rejected: { Icon: XCircle, color: colors.danger, bg: 'rgba(255,92,73,0.12)' },
  booking: { Icon: Ticket, color: colors.accent, bg: 'rgba(155,225,61,0.14)' },
  payout: { Icon: Banknote, color: colors.success, bg: 'rgba(31,138,91,0.16)' },
  review: { Icon: Star, color: '#f5c04a', bg: 'rgba(245,192,74,0.16)' },
  team: { Icon: ShieldCheck, color: colors.accent, bg: 'rgba(155,225,61,0.14)' },
  refund: { Icon: RotateCcw, color: colors.danger, bg: 'rgba(255,92,73,0.12)' },
  cart: { Icon: ShoppingCart, color: '#f5c04a', bg: 'rgba(245,192,74,0.16)' },
};

/** New for this app (2026-09-16) — web's organizer console has never had a
 * notification bell/inbox at all (its own Settings.tsx explicitly dropped a
 * fake "notification prefs" toggle that had no real backend behind it). This
 * is genuinely new product surface, not a port: a real in-app inbox backed
 * by OrgNotification rows, raised on event approve/reject (organizer.
 * service.ts) and, since 2026-09-24, new booking/refund/abandoned-cart too
 * (BookingsService/CartsService) — any future trigger point just calls the
 * same OrgNotificationsService.notify(), no new screen work needed. */
export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
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
          {!loading && rows.length === 0 && (
            <Muted style={styles.centerNote}>Nothing here yet — you'll see updates like event approvals here.</Muted>
          )}
          {rows.map((n, i) => {
            const kind = KIND_ICON[n.icon];
            return (
            <Pressable
              key={n.id}
              onPress={() => {
                // Real bug found live: tapping a row only ever marked it
                // read (and only when unread) — it never used the `to`
                // field the backend already sends, so every tap just sat
                // on the Notifications screen instead of opening the
                // relevant screen (organizer feedback 2026-09-17).
                if (!n.read) markRead(n.id);
                navigateToNotificationTarget(navigation, n.to);
              }}
              style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            >
              <View style={[styles.iconWrap, { backgroundColor: kind?.bg ?? colors.surface2 }]}>
                {kind ? <kind.Icon size={18} color={kind.color} /> : <Ticket size={18} color={colors.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={n.read ? styles.text : styles.textUnread}>{n.text}</Txt>
                <Muted style={styles.tiny}>{timeAgo(n.createdAt)}</Muted>
              </View>
              {!n.read && <View style={styles.dot} />}
            </Pressable>
            );
          })}
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
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: fontSize.s, color: colors.muted },
  textUnread: { fontSize: fontSize.s, fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4 },
});
