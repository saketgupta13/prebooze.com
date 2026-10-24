import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Button, Card, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same real backend contract (POST /me/delete) and same reasoning as
// prebooze-organizer's identical screen: required by Apple/Google for any
// app that creates accounts. Scrubs personal info, keeps booking/payment
// history under the same id for accounting records.
export default function DeleteAccountScreen() {
  const navigation = useNavigation<Nav>();
  const { deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert(
      'Delete your account?',
      "This permanently closes your Prebooze login and removes your personal info. Your booking history is kept for receipts, but you won't be able to sign in again. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof ApiError ? e.message : 'Something went wrong — try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Delete account</Txt>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={26} color={colors.danger} />
        </View>
        <Txt style={styles.h1}>This can't be undone</Txt>
        <Muted style={styles.desc}>
          Deleting your account permanently removes your login and personal info. Your past booking history is kept for receipts, but you'll lose access to this account.
        </Muted>

        <Card style={styles.whatCard}>
          <Muted style={styles.whatLabel}>What happens:</Muted>
          <Txt style={styles.whatItem}>• Your name, photo & bio are removed</Txt>
          <Txt style={styles.whatItem}>• You're logged out everywhere</Txt>
          <Txt style={styles.whatItem}>• Your phone number can be used to sign up again</Txt>
          <Txt style={styles.whatItem}>• Past receipts stay on file for accounting</Txt>
        </Card>

        <Button label={busy ? 'Deleting…' : 'Delete my account'} variant="danger" loading={busy} onPress={confirm} style={styles.deleteBtn} />
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  body: { paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,92,73,0.12)', borderWidth: 2, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.l,
  },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, textAlign: 'center', marginBottom: spacing.s },
  desc: { textAlign: 'center', marginBottom: spacing.l, lineHeight: 20 },
  whatCard: { marginBottom: spacing.xl },
  whatLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, marginBottom: spacing.s },
  whatItem: { fontSize: fontSize.s, lineHeight: 22 },
  deleteBtn: { marginBottom: spacing.s },
});
