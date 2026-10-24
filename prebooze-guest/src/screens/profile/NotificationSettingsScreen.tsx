import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { social } from '../../api/social';
import { IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [marketing, setMarketing] = useState(user?.marketingConsent ?? false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    Notifications.getPermissionsAsync().then((p) => setPermission(p.status));
  }, []));

  const toggleMarketing = async (v: boolean) => {
    setMarketing(v);
    setSaving(true);
    try {
      await social.setMarketingConsent(v);
    } catch {
      setMarketing(!v);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Notifications</Txt>
      </View>

      <View style={styles.content}>
        <Txt style={styles.sectionLabel}>PUSH NOTIFICATIONS</Txt>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt style={styles.rowLabel}>New events from who you follow</Txt>
              <Muted style={styles.rowDesc}>
                {permission === 'granted' ? "Enabled — you'll be notified when they post" : "Blocked by your phone's settings"}
              </Muted>
            </View>
          </View>
          {permission !== 'granted' && (
            <Muted style={styles.enableLink} onPress={() => Linking.openSettings()}>Open phone settings to enable →</Muted>
          )}
        </View>

        <Txt style={styles.sectionLabel}>MARKETING</Txt>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Txt style={styles.rowLabel}>Promotions & offers</Txt>
              <Muted style={styles.rowDesc}>Wallet credits, referral news, occasional deals</Muted>
            </View>
            <Switch
              value={marketing}
              onValueChange={toggleMarketing}
              disabled={saving}
              trackColor={{ false: colors.border3, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingTop: 0 },
  sectionLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.muted, marginBottom: spacing.s, marginTop: spacing.m },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  rowLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.m, marginBottom: 2 },
  rowDesc: { fontSize: fontSize.xs },
  enableLink: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold, marginTop: spacing.s },
});
