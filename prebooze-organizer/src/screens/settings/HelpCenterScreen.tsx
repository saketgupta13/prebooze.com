import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, LifeBuoy, X } from 'lucide-react-native';
import { support } from '../../api/support';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
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
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          <Muted style={styles.tiny}>replies land on WhatsApp</Muted>
        </Card>

        {!loading && tickets.length > 0 && (
          <Card style={styles.card}>
            <Txt style={styles.bold}>Your tickets ({tickets.length})</Txt>
            {tickets.map((t, i) => (
              <View key={t.id} style={[styles.ticketRow, i < tickets.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.bold} numberOfLines={1}>{t.subject}</Txt>
                  <Muted style={styles.tiny}>{t.topic} · {fmtDate(t.createdAt)}</Muted>
                </View>
                <Badge label={t.status === 'open' ? 'Open' : 'Resolved'} tone={t.status === 'open' ? 'default' : 'success'} />
              </View>
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
});
