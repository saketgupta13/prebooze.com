import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronDown, ChevronUp, LifeBuoy, Mail, Send, X } from 'lucide-react-native';
import { support } from '../../api/support';
import { auth } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, H1, IconButton, Input, Muted, Notice, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import Accordion from '../../components/Accordion';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { HelpTicket } from '../../types';

// Exact organizer-role content from prebooze-web/src/pages/HelpCenter.tsx's
// HELP.organizer entry — this app is organizer-only, so there's no role
// picker like web's (which serves 5 roles off one shared page).
const TOPICS = ['Event approval', 'Payouts & withdrawals', 'Scanner & check-in', 'Promoter guest lists', 'Featured placement', 'Something else'];
const FAQS = [
  { q: 'When do I get paid?', a: 'Weekly auto-payouts every Monday, with per-event settlement after the event completes. Track it under Payouts.' },
  { q: 'Why is my event pending?', a: 'Every event is reviewed by the Prebooze team — usually within a day. Edits re-trigger review.' },
  { q: 'How do promoter payouts work?', a: 'You pay promoters directly: per-head on verified arrivals plus gate commission. See Payouts → Promoter payouts.' },
  { q: 'How do I get featured on the home page?', a: 'Use "Feature this event" in My Events (per-event) or the Promote panel on your dashboard (monthly). Admin approves before it goes live.' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function HelpCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { user, refreshUser } = useAuth();
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [addingEmail, setAddingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      support.tickets()
        .then((t) => { if (!cancelled) setTickets(t); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const submit = async () => {
    setErr('');
    if (!subject.trim() || !message.trim()) { setErr('Subject and message are required'); return; }
    setSubmitting(true);
    try {
      const t = await support.raise({ topic: `Organizer · ${topic}`, subject: subject.trim(), message: message.trim() });
      setTickets((prev) => [t, ...prev]);
      setSubject('');
      setMessage('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const saveEmail = async () => {
    if (!emailDraft.trim()) return;
    setSavingEmail(true);
    setErr('');
    try {
      await auth.updateMe({ email: emailDraft.trim() });
      await refreshUser();
      setAddingEmail(false);
      setEmailDraft('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save email');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Help center</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <Txt style={styles.bold}>Raise a ticket</Txt>
            <LifeBuoy size={14} color={colors.accent} />
          </View>
          <FieldLabel>Topic</FieldLabel>
          <SearchableSelect value={topic} onChange={setTopic} options={TOPICS} />
          <FieldLabel>Subject</FieldLabel>
          <Input value={subject} onChangeText={setSubject} placeholder="One line about the issue" style={styles.fieldGap} />
          <FieldLabel>What happened?</FieldLabel>
          <Input value={message} onChangeText={setMessage} placeholder="Tell us the details — ids help (booking / event / payout)…" multiline numberOfLines={4} style={[styles.fieldGap, styles.textarea]} />
          <Button label={submitting ? 'Submitting…' : 'Submit ticket →'} onPress={submit} loading={submitting} style={{ marginTop: spacing.m }} />
          <Muted style={styles.tiny}>{user?.email?.trim() ? `replies land at ${user.email}` : 'add an email below to get replies'}</Muted>
        </Card>

        {!user?.email?.trim() && (
          <Card style={styles.card}>
            <Notice tone="info">
              <View style={{ flex: 1 }}>
                <Txt style={styles.bold}>Add your email to get ticket updates</Txt>
                {/* Real bug (2026-09-24): "add email" here (User.email, your
                 * own account login email) got confused with Organizer.contact
                 * ("Business email" in Settings → Brand profile, shown on
                 * your public profile) — two genuinely separate fields, so
                 * setting one never touched the other. Spelled out explicitly
                 * to stop that mix-up. */}
                <Muted style={styles.tiny}>
                  This is your own account email (we reply here when your ticket status changes) — not your business email, which is
                  under Settings → Brand profile.
                </Muted>
                {addingEmail ? (
                  <View style={{ marginTop: spacing.s }}>
                    <Input value={emailDraft} onChangeText={setEmailDraft} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
                    <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s }}>
                      <Button label={savingEmail ? 'Saving…' : 'Save email'} onPress={saveEmail} loading={savingEmail} style={{ flex: 1 }} />
                      <Button label="Cancel" variant="ghost" onPress={() => { setAddingEmail(false); setEmailDraft(''); }} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setAddingEmail(true)} style={{ marginTop: spacing.s, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Mail size={13} color={colors.accent} />
                    <Txt style={{ color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.s }}>Add email</Txt>
                  </Pressable>
                )}
              </View>
            </Notice>
          </Card>
        )}

        {!loading && tickets.length > 0 && (
          <Card style={styles.card}>
            <Txt style={styles.bold}>Your tickets ({tickets.length})</Txt>
            {tickets.map((t, i) => (
              <TicketRow
                key={t.id}
                ticket={t}
                open={openId === t.id}
                showBorder={i < tickets.length - 1}
                onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                onError={setErr}
              />
            ))}
          </Card>
        )}

        <Card style={styles.card}>
          <Txt style={styles.bold}>Common questions</Txt>
          {FAQS.map((f) => (
            <Accordion key={f.q} title={f.q}>{f.a}</Accordion>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** A ticket row that opens into its full thread — previously a static row
 * with no way to see a reply or follow up (the real gap this closes, same
 * fix as prebooze-web's HelpCenter.tsx). Thread is fetched lazily on first
 * open, not eagerly for every ticket in the list. */
function TicketRow({ ticket, open, showBorder, onToggle, onError }: {
  ticket: HelpTicket;
  open: boolean;
  showBorder: boolean;
  onToggle: () => void;
  onError: (msg: string) => void;
}) {
  const [thread, setThread] = useState<HelpTicket | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleToggle = () => {
    onToggle();
    if (!open && !thread) {
      setLoadingThread(true);
      support.ticket(ticket.id)
        .then(setThread)
        .catch((e) => onError(e instanceof ApiError ? e.message : 'Could not load this ticket'))
        .finally(() => setLoadingThread(false));
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !thread) return;
    setSending(true);
    try {
      const r = await support.reply(ticket.id, reply.trim());
      setThread({ ...thread, replies: [...(thread.replies ?? []), r] });
      setReply('');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not send your reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[showBorder && styles.rowBorder]}>
      <Pressable onPress={handleToggle} style={styles.ticketRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={styles.bold} numberOfLines={1}>{ticket.subject}</Txt>
          <Muted style={styles.tiny}>{ticket.topic} · {fmtDate(ticket.createdAt)}</Muted>
        </View>
        <Badge label={ticket.status === 'open' ? 'Open' : 'Resolved'} tone={ticket.status === 'open' ? 'default' : 'success'} />
        {open ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
      </Pressable>

      {open && (
        <View style={{ paddingBottom: spacing.m }}>
          {loadingThread ? (
            <Muted style={styles.tiny}>Loading…</Muted>
          ) : !thread ? (
            <Muted style={styles.tiny}>Could not load this ticket.</Muted>
          ) : (
            <>
              <View style={styles.bubble}>
                <Txt style={styles.bubbleText}>{thread.message}</Txt>
              </View>
              {(thread.replies ?? []).map((r) => (
                <View key={r.id} style={[styles.bubble, r.fromStaffId && styles.bubbleStaff]}>
                  <Muted style={styles.bubbleFrom}>{r.fromStaffId ? `Prebooze team${r.fromStaff?.name ? ` · ${r.fromStaff.name}` : ''}` : 'You'}</Muted>
                  <Txt style={styles.bubbleText}>{r.message}</Txt>
                </View>
              ))}
              {thread.status === 'open' ? (
                <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.s }}>
                  <Input value={reply} onChangeText={setReply} placeholder="Write a follow-up…" style={{ flex: 1 }} />
                  <IconButton onPress={sendReply} disabled={sending || !reply.trim()}>
                    <Send size={16} color={colors.accent} />
                  </IconButton>
                </View>
              ) : (
                <Muted style={[styles.tiny, { marginTop: spacing.s }]}>This ticket is resolved — raise a new one if you need more help.</Muted>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Txt style={styles.fieldLabel}>{children}</Txt>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  card: { padding: spacing.l, marginBottom: spacing.m },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: spacing.s },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.m },
  fieldGap: { marginBottom: 0 },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: spacing.s },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  bubble: { backgroundColor: colors.surface2, borderRadius: 8, padding: spacing.s, marginTop: spacing.s },
  bubbleStaff: { backgroundColor: 'rgba(155, 225, 61, 0.1)' },
  bubbleFrom: { fontSize: 10.5, fontFamily: fontFamily.bold, marginBottom: 2 },
  bubbleText: { fontSize: fontSize.s },
});
