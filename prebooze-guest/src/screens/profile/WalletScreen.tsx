import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { wallet } from '../../api/wallet';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { WalletTx } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<{ balance: number; txs: WalletTx[] } | null>(null);

  useEffect(() => {
    wallet.balance().then(setData).catch(() => setData({ balance: 0, txs: [] }));
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Wallet</Txt>
      </View>

      {!data && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {data && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.balanceCard}>
            <Txt style={styles.balanceLabel}>WALLET BALANCE</Txt>
            <Txt style={styles.balanceValue}>₹{data.balance}</Txt>
            <Muted style={styles.balanceHint}>Credits are spend-only, used automatically at checkout</Muted>
          </View>

          <Txt style={styles.sectionLabel}>Recent activity</Txt>
          {data.txs.length === 0 && <Muted>No transactions yet — refer a friend to earn your first credit.</Muted>}
          {data.txs.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txIcon}>
                {tx.amount >= 0 ? <ArrowDownLeft size={15} color={colors.accent} /> : <ArrowUpRight size={15} color={colors.danger} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.txNote}>{tx.note}</Txt>
                <Muted style={styles.txDate}>{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Muted>
              </View>
              <Txt style={[styles.txAmount, { color: tx.amount >= 0 ? colors.accent : colors.text }]}>
                {tx.amount >= 0 ? '+' : ''}₹{tx.amount}
              </Txt>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  balanceCard: { backgroundColor: colors.accent, borderRadius: radius.l, padding: spacing.xl, marginBottom: spacing.l },
  balanceLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: 'rgba(20,21,15,0.7)', marginBottom: 6 },
  balanceValue: { fontSize: 30, fontFamily: fontFamily.extrabold, color: colors.onAccent },
  balanceHint: { fontSize: fontSize.xs, color: 'rgba(20,21,15,0.65)', marginTop: 6 },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.s },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  txNote: { fontSize: fontSize.s, fontFamily: fontFamily.medium },
  txDate: { fontSize: fontSize.xs },
  txAmount: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
});
