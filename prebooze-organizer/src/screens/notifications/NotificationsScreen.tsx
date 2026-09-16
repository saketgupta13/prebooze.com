import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Banknote, CheckCircle2, ShieldCheck, Star, Ticket, XCircle, ArrowLeft, X, type LucideIcon } from 'lucide-react-native';
import { notifications } from '../../api/notifications';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';
import type { DashboardStackParamList } from '../../navigation/types';
import type { OrgNotification } from '../../types';

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
};

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

  // TEMPORARY — only tappable dev entry point for the matching temporary
  // backend route (see OrgNotificationsService.seedDemo's own comment).
  // Remove this button + its handler together with that route once the
  // organizer has previewed the panel.
  const [seeding, setSeeding] = useState(false);
  // A real bug hit live: a single tap fired this handler twice (12 rows
  // instead of 6, timestamps 1ms apart) — `disabled={seeding}` alone isn't
  // enough because the state update that flips it isn't applied before a
  // near-simultaneous second touch event is processed. A ref-backed guard
  // is checked and set synchronously, before React's render cycle is even
  // involved, so a second rapid tap is dropped regardless of timing.
  const seedingRef = useRef(false);
  const seedDemo = () => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    setSeeding(true);
    notifications.seedDemo()
      .then(() => notifications.list())
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to seed demo notifications'))
      .finally(() => { seedingRef.current = false; setSeeding(false); });
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
            <View style={styles.centerNote}>
              <Muted>Nothing here yet — you'll see updates like event approvals here.</Muted>
              <Pressable onPress={seedDemo} disabled={seeding} style={styles.seedButton}>
                <Txt style={styles.link}>{seeding ? 'Adding examples…' : 'Preview with example notifications (dev)'}</Txt>
              </Pressable>
            </View>
          )}
          {rows.map((n, i) => {
            const kind = KIND_ICON[n.icon];
            return (
            <Pressable
              key={n.id}
              onPress={() => !n.read && markRead(n.id)}
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
  centerNote: { alignItems: 'center', padding: spacing.l, gap: spacing.m },
  seedButton: { padding: spacing.s },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: fontSize.s, color: colors.muted },
  textUnread: { fontSize: fontSize.s, fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4 },
});
