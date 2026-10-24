import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, LifeBuoy, Mail, MessageCircle, Send } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../api/auth';
import { support, faqs as faqsApi } from '../../api/support';
import { ApiError } from '../../api/client';
import { Button, Chip, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { CmsFaq, HelpTicket } from '../../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Guest-only (this is the guest app) — same topic/FAQ set as web's
// HELP.guest entry in HelpCenter.tsx. FAQ *content* comes from the real
// CMS (GET /faqs?audience=guests); topics stay a fixed local list since
// they're just ticket categorization, not CMS-managed content.
const TOPICS = ['Booking & tickets', 'Refunds & wallet', 'Guest lists', 'Payments', 'Account & login', 'Something else'];
const FALLBACK_FAQS: { question: string; answer: string }[] = [
  { question: 'How do I get my ticket?', answer: 'It lands on your WhatsApp instantly after payment — also downloadable as a PNG from My Bookings.' },
  { question: 'How do refunds work?', answer: 'Cancel from My Bookings and choose: instant Prebooze wallet credit, or back to your payment method in 5–7 days.' },
  { question: 'What is the free guest list?', answer: 'Promoters run free-entry lists with a time cutoff. Join via their link, get a rotating QR, arrive before the cutoff.' },
  { question: 'The event is sold out — now what?', answer: 'Join the waitlist on the event page. Freed spots are offered first-come first-served.' },
];

export default function HelpCenterScreen() {
  const navigation = useNavigation<Nav>();
  const { user, refreshUser } = useAuth();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(FALLBACK_FAQS);

  useEffect(() => {
    support.tickets().then(setTickets).catch(() => setTickets([]));
    faqsApi.list('guests').then((rows: CmsFaq[]) => { if (rows.length) setFaqs(rows); }).catch(() => {});
  }, []);

  const submitTicket = async () => {
    if (!subject.trim() || !message.trim()) return Alert.alert('Subject and message are required');
    setSubmitting(true);
    try {
      const t = await support.raise({ topic: `Guest · ${topic}`, subject: subject.trim(), message: message.trim() });
      setTickets((prev) => [t, ...(prev ?? [])]);
      setSubject('');
      setMessage('');
      Alert.alert('Ticket raised', 'We usually reply within a few hours ✓');
    } catch (e) {
      Alert.alert('Could not submit', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveEmail = async () => {
    if (!emailDraft.trim()) return;
    setSavingEmail(true);
    try {
      await auth.updateMe({ email: emailDraft.trim() });
      await refreshUser();
      setAddingEmail(false);
      setEmailDraft('');
    } catch (e) {
      Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ArrowLeftBtn onPress={() => navigation.goBack()} />
        <Txt style={styles.title}>Help center</Txt>
        <LifeBuoy size={18} color={colors.text} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={80} contentContainerStyle={styles.content}>
        <View style={styles.whatsappCard}>
          <MessageCircle size={22} color={colors.whatsapp} />
          <View style={{ flex: 1 }}>
            <Txt style={styles.rowLabel}>Chat with us on WhatsApp</Txt>
            <Muted style={styles.rowDesc}>Fastest way to reach us for booking or payment issues</Muted>
          </View>
        </View>
        <Button label="Open WhatsApp" onPress={() => Linking.openURL('https://wa.me/919545733727')} style={{ marginBottom: spacing.l }} />

        <View style={styles.card}>
          <Txt style={styles.cardTitle}>Raise a ticket</Txt>
          <Muted style={styles.fieldLabel}>Topic</Muted>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => <Chip key={t} label={t} active={topic === t} onPress={() => setTopic(t)} />)}
          </View>
          <Muted style={styles.fieldLabel}>Subject</Muted>
          <TextInput value={subject} onChangeText={setSubject} placeholder="One line about the issue" placeholderTextColor={colors.muted} style={styles.input} />
          <Muted style={styles.fieldLabel}>What happened?</Muted>
          <TextInput value={message} onChangeText={setMessage} placeholder="Tell us the details — booking id helps…" placeholderTextColor={colors.muted} multiline numberOfLines={4} style={[styles.input, styles.textarea]} />
          <Button label={submitting ? 'Submitting…' : 'Submit ticket →'} loading={submitting} onPress={submitTicket} style={{ marginTop: spacing.s }} />
          <Muted style={styles.replyHint}>{user?.email?.trim() ? `replies land at ${user.email}` : 'add an email below to get replies'}</Muted>
        </View>

        {!user?.email?.trim() && (
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <Mail size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Txt style={styles.rowLabel}>Add your email to get ticket updates</Txt>
                <Muted style={styles.rowDesc}>We reply by email when your ticket status changes — no email on file yet.</Muted>
              </View>
            </View>
            {!addingEmail ? (
              <Button label="Add email →" variant="ghost" onPress={() => setAddingEmail(true)} style={{ marginTop: spacing.s, alignSelf: 'flex-start' }} />
            ) : (
              <View style={{ marginTop: spacing.s }}>
                <TextInput value={emailDraft} onChangeText={setEmailDraft} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.muted} style={styles.input} />
                <View style={styles.btnRow}>
                  <Button label={savingEmail ? 'Saving…' : 'Save email'} disabled={savingEmail || !emailDraft.trim()} onPress={saveEmail} style={{ flex: 1 }} />
                  <Button label="Cancel" variant="ghost" onPress={() => { setAddingEmail(false); setEmailDraft(''); }} style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </View>
        )}

        {tickets === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.l }} />
        ) : tickets.length > 0 ? (
          <View style={styles.card}>
            <Txt style={styles.cardTitle}>Your tickets ({tickets.length})</Txt>
            {tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Txt style={styles.cardTitle}>Common questions</Txt>
          {faqs.map((f) => <FaqRow key={f.question} q={f.question} a={f.answer} />)}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Txt style={styles.rowLabel}>Email support</Txt>
            <Muted style={styles.rowDesc}>info@prebooze.com</Muted>
          </View>
          <Button label="Email" variant="ghost" onPress={() => Linking.openURL('mailto:info@prebooze.com')} style={styles.openBtn} />
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function ArrowLeftBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <ArrowLeft size={18} color={colors.text} />
    </Pressable>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faqRow}>
      <Pressable style={styles.faqQRow} onPress={() => setOpen((o) => !o)}>
        <Txt style={styles.faqQ}>{q}</Txt>
        {open ? <ChevronUp size={15} color={colors.muted} /> : <ChevronDown size={15} color={colors.muted} />}
      </Pressable>
      {open && <Muted style={styles.faqA}>{a}</Muted>}
    </View>
  );
}

function TicketRow({ ticket, open, onToggle }: { ticket: HelpTicket; open: boolean; onToggle: () => void }) {
  const [thread, setThread] = useState<HelpTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleToggle = () => {
    onToggle();
    if (!open && !thread) {
      setLoading(true);
      support.ticket(ticket.id).then(setThread).catch(() => {}).finally(() => setLoading(false));
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !thread) return;
    setSending(true);
    try {
      const r = await support.reply(ticket.id, reply.trim());
      setThread({ ...thread, replies: [...(thread.replies ?? []), r] });
      setReply('');
    } catch {
      Alert.alert("Couldn't send", 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.ticketRow}>
      <Pressable style={styles.ticketHeadRow} onPress={handleToggle}>
        <View style={{ flex: 1 }}>
          <Txt style={styles.ticketSubject}>{ticket.subject} <Muted>· {ticket.id}</Muted></Txt>
          <Muted style={styles.ticketMeta}>{ticket.topic} · {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Muted>
        </View>
        {ticket.status === 'open' ? (
          <View style={styles.badgePending}><Txt style={styles.badgePendingTxt}>Open</Txt></View>
        ) : (
          <View style={styles.badgeOk}><Txt style={styles.badgeOkTxt}>Resolved</Txt><CheckCircle2 size={11} color={colors.accent} /></View>
        )}
        {open ? <ChevronUp size={15} color={colors.muted} /> : <ChevronDown size={15} color={colors.muted} />}
      </Pressable>

      {open && (
        <View style={styles.threadWrap}>
          {loading ? (
            <Muted style={styles.threadLoading}>Loading…</Muted>
          ) : !thread ? (
            <Muted style={styles.threadLoading}>Could not load this ticket.</Muted>
          ) : (
            <>
              <View style={styles.msgBubble}><Muted style={styles.msgTxt}>{thread.message}</Muted></View>
              {(thread.replies ?? []).map((r) => (
                <View key={r.id} style={[styles.msgBubble, r.fromStaffId && styles.msgBubbleStaff]}>
                  <Muted style={styles.msgFrom}>{r.fromStaffId ? `Prebooze team${r.fromStaff?.name ? ` · ${r.fromStaff.name}` : ''}` : 'You'}</Muted>
                  <Txt style={styles.msgTxt}>{r.message}</Txt>
                </View>
              ))}
              {thread.status === 'open' ? (
                <View style={styles.replyRow}>
                  <TextInput value={reply} onChangeText={setReply} placeholder="Write a follow-up…" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} />
                  <Pressable onPress={sendReply} disabled={sending} style={styles.sendBtn}>
                    <Send size={14} color={colors.onAccent} />
                  </Pressable>
                </View>
              ) : (
                <Muted style={styles.threadLoading}>This ticket is resolved — raise a new one if you need more help.</Muted>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { flex: 1, fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  whatsappCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: 'rgba(37,211,102,0.08)',
    borderWidth: 1, borderColor: colors.whatsapp, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.m,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m, marginBottom: spacing.m },
  rowLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  rowDesc: { fontSize: fontSize.xs },
  openBtn: { height: 38, paddingHorizontal: spacing.l },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.m },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  fieldLabel: { fontSize: fontSize.xs, marginTop: spacing.s, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.m, paddingVertical: spacing.s, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.s,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  replyHint: { fontSize: fontSize.xs, marginTop: spacing.s },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  btnRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  faqRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.s },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  faqA: { fontSize: fontSize.xs, marginTop: spacing.s },
  ticketRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.s },
  ticketHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  ticketSubject: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  ticketMeta: { fontSize: fontSize.xs },
  badgeOk: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(155,225,61,0.12)', borderRadius: radius.s, paddingHorizontal: 7, paddingVertical: 3 },
  badgeOkTxt: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  badgePending: { backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: 7, paddingVertical: 3 },
  badgePendingTxt: { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  threadWrap: { marginTop: spacing.s },
  threadLoading: { fontSize: fontSize.xs },
  msgBubble: { backgroundColor: colors.surface2, borderRadius: radius.s, padding: spacing.s, marginBottom: spacing.s },
  msgBubbleStaff: { backgroundColor: 'rgba(155,225,61,0.1)' },
  msgFrom: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, marginBottom: 2 },
  msgTxt: { fontSize: fontSize.xs },
  replyRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: radius.m, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
