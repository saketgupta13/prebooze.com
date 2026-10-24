import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Bell, PartyPopper, Ticket, X } from 'lucide-react-native';
import { social, type GuestNotification } from '../../api/social';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mirrors the backend's icon-slug convention (GuestNotificationsService) —
// a short kind slug, not a raw emoji, same reasoning as the organizer app's
// own KIND_ICON map (consistent vector icon instead of a text glyph).
const KIND_ICON: Record<string, { Icon: typeof Ticket; color: string; bg: string }> = {
  event: { Icon: PartyPopper, color: colors.accent, bg: 'rgba(155,225,61,0.14)' },
  going: { Icon: Ticket, color: colors.accent, bg: 'rgba(155,225,61,0.14)' },
  // Waitlist spot freed + wishlisted-event low-stock pushes — both
  // time-sensitive "act now" triggers, given a distinct amber tint rather
  // than reusing the accent green that 'event'/'going' already use, so the
  // inbox visually separates "something to act on" from "fyi".
  ticket: { Icon: Ticket, color: '#f5c04a', bg: 'rgba(245,192,74,0.14)' },
};

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Real in-app inbox, backed by GuestNotification rows — the bell icon on
 * Home used to just open push-preference settings because no feed existed
 * at all (every push was fire-and-forget with nothing stored for later
 * viewing). Raised today on: a new event from a followed organizer/venue/
 * lineup, a followed person confirming a booking (going) — any future
 * trigger point just calls the same GuestNotificationsService.notify(), no
 * new screen work needed. */
export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const [rows, setRows] = useState<GuestNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      social.notifications()
        .then((rs) => { if (!cancelled) setRows(rs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load notifications'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const unreadCount = rows.filter((r) => !r.read).length;

  const markRead = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)));
    social.markNotificationRead(id).catch(() => {});
  };

  const markAllRead = () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    social.markAllNotificationsRead().catch(() => {});
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
            <Muted style={styles.centerNote}>Nothing here yet — follow people and organizers to see updates.</Muted>
          )}
          {rows.map((n, i) => {
            const kind = KIND_ICON[n.icon];
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (!n.read) markRead(n.id);
                  if (n.to) navigation.navigate('EventDetail', { slug: n.to });
                }}
                style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.iconWrap, { backgroundColor: kind?.bg ?? colors.surface2 }]}>
                  {kind ? <kind.Icon size={18} color={kind.color} /> : <Bell size={18} color={colors.muted} />}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.xl },
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
