import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { orgTeam, orgRoles } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Button, Card, Checkbox, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { ORG_PERMISSION_MODULES, type OrgModulePerms, type OrgPermKey, type OrgStaffMember } from '../../types';
import type { MoreStackParamList } from '../../navigation/types';

const PERM_KEYS: OrgPermKey[] = ['view', 'edit'];

/** Faithful port of prebooze-web/src/pages/organizer/OrgTeamRoles.tsx.
 * "Owner" is a reserved role, enforced server-side too: can't invite as
 * Owner, can't promote to Owner, can't edit/remove the Owner role, can't
 * remove an Owner staff member. Default roles (Owner/Manager/Door
 * staff/Promoter) are lazily seeded server-side on first load. */
export default function TeamRolesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [staff, setStaff] = useState<OrgStaffMember[]>([]);
  const [roles, setRoles] = useState<Record<string, OrgModulePerms>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Door staff');
  const [inviteScan, setInviteScan] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);

  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRole, setSelectedRole] = useState('Owner');

  const roleNames = Object.keys(roles);

  const load = () =>
    Promise.all([orgTeam.listStaff(), orgRoles.list()]).then(([s, r]) => {
      setStaff(s);
      setRoles(r);
      setSelectedRole((prev) => (r[prev] ? prev : (Object.keys(r)[0] ?? 'Owner')));
    });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load()
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const invite = async () => {
    if (!inviteName.trim() || !invitePhone.trim()) return;
    setErr('');
    setInviting(true);
    try {
      await orgTeam.addStaff({ name: inviteName.trim(), phone: invitePhone.trim(), email: inviteEmail.trim() || undefined, roleName: inviteRole, scan: inviteScan });
      setInviteName('');
      setInvitePhone('');
      setInviteEmail('');
      setShowInvite(false);
      setInvited(true);
      setTimeout(() => setInvited(false), 4000);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (id: string, roleName: string) => {
    try {
      await orgTeam.updateStaffRole(id, roleName);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  const removeStaff = (m: OrgStaffMember) => {
    Alert.alert('Remove from the team?', `Remove ${m.name} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await orgTeam.removeStaff(m.id);
            await load();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Failed to remove');
          }
        },
      },
    ]);
  };

  const createRole = async () => {
    const n = newRoleName.trim();
    if (!n || roles[n]) return;
    try {
      await orgRoles.add(n);
      setNewRoleName('');
      setShowNewRole(false);
      setSelectedRole(n);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to create role');
    }
  };

  const togglePerm = async (module: string, key: OrgPermKey, value: boolean) => {
    setRoles((prev) => ({ ...prev, [selectedRole]: { ...prev[selectedRole], [module]: { ...prev[selectedRole]?.[module], [key]: value } } }));
    try {
      await orgRoles.setPerm(selectedRole, module, key, value);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update permission');
      await load();
    }
  };

  const removeRole = () => {
    Alert.alert(`Remove the "${selectedRole}" role?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await orgRoles.remove(selectedRole);
            setSelectedRole('Manager');
            await load();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Failed to remove role');
          }
        },
      },
    ]);
  };

  const isOwnerRole = selectedRole === 'Owner';
  const perms = roles[selectedRole] ?? {};

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Team & roles</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}
        {invited && (
          <View style={styles.errRow}>
            <Check size={14} color={colors.accent} />
            <Txt style={{ color: colors.accent, fontSize: fontSize.s }}>Invite sent</Txt>
          </View>
        )}

        <Button label={showInvite ? 'Hide form' : '+ Invite member'} variant={showInvite ? 'ghost' : 'primary'} onPress={() => setShowInvite((s) => !s)} style={{ marginBottom: spacing.m }} />

        {showInvite && (
          <Card style={styles.card}>
            <FieldLabel>Name</FieldLabel>
            <Input value={inviteName} onChangeText={setInviteName} autoFocus style={styles.fieldGap} />
            <FieldLabel>Phone number</FieldLabel>
            <Input value={invitePhone} onChangeText={setInvitePhone} placeholder="+91 98765 43210" keyboardType="phone-pad" style={styles.fieldGap} />
            <FieldLabel>Email (optional)</FieldLabel>
            <Input value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" style={styles.fieldGap} />
            <FieldLabel>Role</FieldLabel>
            <View style={styles.chipRow}>
              {roleNames.filter((r) => r !== 'Owner').map((r) => (
                <Chip key={r} label={r} active={inviteRole === r} onPress={() => setInviteRole(r)} />
              ))}
            </View>
            <View style={{ marginTop: spacing.m }}>
              <Checkbox checked={inviteScan} onChange={setInviteScan} label="allow door-scan access" />
            </View>
            <Muted style={styles.tiny}>They'll get a WhatsApp + email invite and log in with this phone number — the console they see is scoped to the role you pick.</Muted>
            <Button label={inviting ? 'Sending…' : 'Invite'} onPress={invite} loading={inviting} disabled={!inviteName.trim() || !invitePhone.trim()} style={{ marginTop: spacing.m }} />
          </Card>
        )}

        <Card style={styles.card}>
          <Txt style={styles.bold}>Team</Txt>
          {loading && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>Loading…</Muted>}
          {!loading && staff.length === 0 && <Muted style={[styles.centerNote, { marginTop: spacing.s }]}>No team members yet — invite one above.</Muted>}
          {staff.map((m, i) => (
            <View key={m.id} style={[styles.staffRow, i < staff.length - 1 && styles.rowBorder]}>
              <Txt style={styles.bold} numberOfLines={1}>{m.name}</Txt>
              <Muted style={styles.tiny} numberOfLines={1}>{m.phone ?? 'no phone on file'} · {m.scan ? 'door-scan access' : 'no scan access'}</Muted>
              {m.roleName === 'Owner' ? (
                <Txt style={styles.ownerBadge}>Owner</Txt>
              ) : (
                <View style={styles.staffActions}>
                  <View style={[styles.chipRow, { flex: 1 }]}>
                    {roleNames.filter((r) => r !== 'Owner').map((r) => (
                      <Chip key={r} label={r} active={m.roleName === r} onPress={() => changeRole(m.id, r)} />
                    ))}
                  </View>
                  <IconButton tone="danger" onPress={() => removeStaff(m)}>
                    <X size={14} color={colors.danger} />
                  </IconButton>
                </View>
              )}
            </View>
          ))}
        </Card>
        <Muted style={styles.footerNote}>changing a role applies its permission matrix to that member immediately</Muted>

        <View style={styles.sectionHead}>
          <Txt style={[styles.bold, styles.sectionTitle]}>Role editor</Txt>
          <Pressable onPress={() => setShowNewRole((s) => !s)}><Txt style={styles.link}>+ New role</Txt></Pressable>
        </View>

        {showNewRole && (
          <Card style={styles.card}>
            <Input value={newRoleName} onChangeText={setNewRoleName} placeholder="Role name (e.g. Bar lead)" style={styles.fieldGap} />
            <Button label="Create role" onPress={createRole} disabled={!newRoleName.trim() || !!roles[newRoleName.trim()]} style={{ marginTop: spacing.m }} />
          </Card>
        )}

        <View style={[styles.chipRow, { marginBottom: spacing.m }]}>
          {roleNames.map((r) => (
            <Chip key={r} label={r} active={selectedRole === r} onPress={() => setSelectedRole(r)} />
          ))}
        </View>

        <Card style={styles.card}>
          <View style={styles.permHead}>
            <Txt style={styles.bold}>Role: {selectedRole} — permissions</Txt>
            {savedFlash && <Check size={14} color={colors.accent} />}
          </View>
          {isOwnerRole && <Muted style={styles.tiny}>(Owner always has full access)</Muted>}

          <View style={[styles.permRow, styles.permHeaderRow]}>
            <Txt style={[styles.permModule, styles.bold]}>Module</Txt>
            <Txt style={[styles.permHeaderCell, styles.bold]}>View</Txt>
            <Txt style={[styles.permHeaderCell, styles.bold]}>Edit</Txt>
          </View>
          {ORG_PERMISSION_MODULES.map((mod) => (
            <View key={mod} style={styles.permRow}>
              <Txt style={styles.permModule} numberOfLines={1}>{mod}</Txt>
              {PERM_KEYS.map((k) => (
                <Pressable
                  key={k}
                  style={styles.permCell}
                  disabled={isOwnerRole}
                  onPress={() => togglePerm(mod, k, !perms[mod]?.[k])}
                >
                  <View style={[styles.checkboxBox, (isOwnerRole || perms[mod]?.[k]) && styles.checkboxBoxOn]}>
                    {(isOwnerRole || perms[mod]?.[k]) && <Check size={12} color={colors.onAccent} />}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}

          {!isOwnerRole && <Button label="Remove role" variant="danger" onPress={removeRole} style={{ marginTop: spacing.l }} />}
        </Card>
        <Muted style={styles.footerNote}>roles: Owner · Manager · Door staff · Promoter — plus your custom roles · scan access is set per member on invite</Muted>
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
  centerNote: { textAlign: 'center' },
  card: { padding: spacing.l, marginBottom: spacing.m },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 4 },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldGap: { marginBottom: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  // Real bug (2026-09-17): this used to be a single flexDirection:'row'
  // with the name/phone in a flex:1 box next to the role chips + remove
  // button — three role chips plus a remove button don't fit next to a
  // phone number on a phone-width screen, so the flex:1 box got squeezed
  // to near-zero width and its text wrapped one or two characters per
  // line. Web gets away with this via a compact native <select> instead of
  // a chip row; stacking vertically here avoids the squeeze regardless of
  // how many roles exist.
  staffRow: { paddingVertical: spacing.m, gap: 4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  ownerBadge: { alignSelf: 'flex-start', marginTop: spacing.xs, fontSize: 11, fontFamily: fontFamily.bold, color: colors.accent, backgroundColor: 'rgba(155,225,61,0.14)', borderColor: colors.accent, borderWidth: 1, paddingHorizontal: spacing.s, paddingVertical: 4, borderRadius: 999 },
  staffActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  footerNote: { fontSize: 11, marginTop: spacing.s, marginBottom: spacing.l },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
  sectionTitle: { fontSize: fontSize.l },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 12.5 },
  permHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: 2 },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  permHeaderRow: { borderBottomColor: colors.border3, marginTop: spacing.s },
  permModule: { flex: 1, fontSize: fontSize.s },
  permCell: { width: 56, alignItems: 'center', justifyContent: 'center' },
  // `alignItems`/`justifyContent` above only center a *container's*
  // children — applied directly to a Text they do nothing, so the "View"/
  // "Edit" header labels sat left-aligned while the checkboxes below them
  // were genuinely centered (organizer feedback 2026-09-16). textAlign is
  // the property Text actually respects.
  permHeaderCell: { width: 56, textAlign: 'center' },
  checkboxBox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border3, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
