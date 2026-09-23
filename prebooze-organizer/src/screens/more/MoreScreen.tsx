import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Banknote, ChevronRight, CreditCard, LifeBuoy, type LucideIcon, Megaphone, Radio, Receipt, Settings as SettingsIcon, ShieldCheck, ShoppingCart, Star, Tag, Users as UsersIcon } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, H1, H2, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { SITE_ORIGIN } from '../../lib/urls';
import type { MoreStackParamList } from '../../navigation/types';

// Non-pinned NAV items from OrganizerLayout.tsx (Dashboard/Events/Scanner/
// Bookings have their own tabs) — "Live monitor" through "Settings" live
// here. Real screens land phase-by-phase; `screen` wires a row to its real
// destination once built, everything else stays a non-interactive
// placeholder row until its phase lands.
const MORE_ITEMS: { label: string; icon: LucideIcon; module?: string | 'owner'; screen?: keyof MoreStackParamList }[] = [
  { label: 'Guest list', icon: UsersIcon, module: 'Guest list', screen: 'GuestList' },
  { label: 'Live monitor', icon: Radio, module: 'Attendees & check-in', screen: 'LiveMonitor' },
  { label: 'Reviews', icon: Star, module: 'Reviews', screen: 'Reviews' },
  { label: 'Promo codes', icon: Tag, module: 'Coupons', screen: 'Coupons' },
  { label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard', screen: 'AbandonedCarts' },
  { label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals', screen: 'Payouts' },
  { label: 'Transactions', icon: Receipt, module: 'Payouts & withdrawals', screen: 'Transactions' },
  { label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals', screen: 'Promoters' },
  { label: 'Team & roles', icon: ShieldCheck, module: 'Settings & team', screen: 'TeamRoles' },
  { label: 'Settings', icon: SettingsIcon, module: 'Settings & team', screen: 'Settings' },
];

export default function MoreScreen() {
  const { user, accessState, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const canView = (module?: string | 'owner') => {
    if (module === undefined) return true;
    if (accessState.kind === 'owner') return true;
    if (accessState.kind === 'team') return module !== 'owner' && !!accessState.access.permissions[module]?.view;
    return false;
  };

  const brand = accessState.kind === 'team' ? accessState.access.organizerBrand : user?.orgBrand;
  const logoUrl = accessState.kind === 'team' ? accessState.access.organizerLogoUrl : user?.orgLogoUrl;
  const roleLabel = accessState.kind === 'team' ? accessState.access.roleName : 'Owner';

  return (
    <Screen style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <H1 style={styles.heading}>More</H1>
      <View style={styles.header}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Txt style={styles.avatarInitial}>{(brand ?? '?')[0]}</Txt></View>
        )}
        <View style={{ flex: 1 }}>
          <H2>{brand ?? 'Organizer'}</H2>
          <Muted>{roleLabel}</Muted>
        </View>
      </View>

      <Card style={styles.list}>
        {MORE_ITEMS.filter((i) => canView(i.module)).map((item, idx, arr) => (
          <Pressable
            key={item.label}
            disabled={!item.screen}
            onPress={item.screen ? () => navigation.navigate(item.screen as 'GuestList' | 'LiveMonitor' | 'Reviews' | 'Coupons' | 'AbandonedCarts' | 'Payouts' | 'Transactions' | 'Promoters' | 'TeamRoles' | 'Settings') : undefined}
            style={[styles.row, idx < arr.length - 1 && styles.rowBorder]}
          >
            <item.icon size={18} color={colors.muted} />
            <Txt style={styles.rowLabel}>{item.label}</Txt>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      {accessState.kind === 'owner' && (
        <Card style={[styles.list, { marginTop: spacing.l }]}>
          {/* Ad-campaign spend/billing is deliberately out of scope for this
           * app (real money, Meta ad management — see CLAUDE.md) — opens the
           * real web page instead of a native screen. Not an authed
           * handoff: if the organizer isn't already logged into
           * prebooze.com in their device browser, they'll hit web's own
           * login there (same phone/OTP flow, just a second login). */}
          <Pressable style={styles.row} onPress={() => Linking.openURL(`${SITE_ORIGIN}/organizer/billing`)}>
            <Megaphone size={18} color={colors.muted} />
            <Txt style={styles.rowLabel}>Featured & billing</Txt>
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
        </Card>
      )}

      {/* Personal-account items (2026-09-22) — shared across every role,
       * not organizer-business permissions, so always visible regardless
       * of accessState.kind — matching web's NAV entries with no `module`. */}
      <Card style={[styles.list, { marginTop: spacing.l }]}>
        <Pressable style={[styles.row, styles.rowBorder]} onPress={() => navigation.navigate('PaymentMethods')}>
          <CreditCard size={18} color={colors.muted} />
          <Txt style={styles.rowLabel}>Payment methods</Txt>
          <ChevronRight size={16} color={colors.muted} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate('HelpCenter')}>
          <LifeBuoy size={18} color={colors.muted} />
          <Txt style={styles.rowLabel}>Help center</Txt>
          <ChevronRight size={16} color={colors.muted} />
        </Pressable>
      </Card>

      <Button label="Log out" variant="ghost" onPress={logout} style={styles.logout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.l, paddingBottom: spacing.xxl },
  heading: { marginTop: spacing.s },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginBottom: spacing.xl, marginTop: spacing.l },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.accent },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1 },
  logout: { marginTop: spacing.xl },
});
