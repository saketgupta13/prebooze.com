import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PartyPopper, XCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../api/auth';
import { ApiError } from '../../api/client';
import { ageFromDob } from '../../lib/ageGate';
import { htmlToPlainText, plainTextToHtml } from '../../lib/richtext';
import { autoFormatDobInput, displayDobToIso, isoToDisplayDob } from '../../lib/dob';
import { Button, Chip, Muted, Screen, Txt } from '../../components/ui';
import AvatarUploadBox from '../../components/AvatarUploadBox';
import SocialLinksEditor from '../../components/SocialLinksEditor';
import InterestsPicker from '../../components/InterestsPicker';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { SocialLinks } from '../../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

/** Soft-required "finish your profile" nudge — same fields/validation as
 * web's FinishProfile.tsx, awards a one-time 10%-off coupon on save (see
 * AuthService.claimProfileCompletionReward). Getting here and leaving are
 * both optional (linked from Confirmation.tsx/ProfileScreen, dismissible);
 * the fields are required only once someone opens this and hits Save. */
export default function FinishProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, refreshUser } = useAuth();
  const [dob, setDob] = useState(isoToDisplayDob(user?.dob ?? ''));
  const [gender, setGender] = useState(user?.gender ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [profession, setProfession] = useState(user?.profession ?? '');
  const [languages, setLanguages] = useState(user?.languages ?? '');
  const [bio, setBio] = useState(htmlToPlainText(user?.bio ?? ''));
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user?.socialLinks ?? {});
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [city, setCity] = useState(user?.city ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [country, setCountry] = useState(user?.country ?? 'India');
  const [photo, setPhoto] = useState(user?.avatarUrl ?? '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [usernameErr, setUsernameErr] = useState('');
  const [reward, setReward] = useState<{ code: string; maxDiscount: number; validTill: string } | null>(null);

  const dobIso = displayDobToIso(dob);
  const displayAge = dobIso ? ageFromDob(dobIso) : null;

  const goHome = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));

  const save = async () => {
    setErr('');
    setUsernameErr('');
    if (!photo) return setErr('A profile photo is required');
    if (!dobIso) return setErr('A valid date of birth (DD-MM-YYYY) is required');
    if (!gender) return setErr('Gender is required');
    if (!username.trim()) return setErr('Username is required');
    if (!city.trim()) return setErr('City is required');
    if (!state.trim()) return setErr('State is required');
    if (!country.trim()) return setErr('Country is required');
    if (!profession.trim()) return setErr('Profession is required');
    if (!languages.trim()) return setErr('Languages is required');
    if (!bio.trim()) return setErr('Bio is required');
    if (!Object.values(socialLinks).some((v) => v?.trim())) return setErr('At least one social link is required');
    if (interests.length === 0) return setErr('Pick at least one interest');
    if (photoUploading) return setErr('Photo is still uploading — wait for it to finish before saving');

    setSaving(true);
    try {
      await auth.updateMe({
        dob: dobIso, gender, username: username.trim().toLowerCase(), profession: profession.trim(), languages: languages.trim(), bio: plainTextToHtml(bio.trim()),
        city, state, country, interests, avatarUrl: photo, socialLinks,
      });
      await refreshUser();
      const claimed = await auth.claimProfileReward();
      await refreshUser();
      setReward(claimed);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to save profile';
      if (/username/i.test(msg)) setUsernameErr(msg);
      else setErr(msg);
    } finally {
      setSaving(false);
    }
  };

  if (reward || user?.profileRewardClaimedAt) {
    const code = reward?.code ?? user?.profileRewardCode ?? '';
    const validTill = reward ? new Date(reward.validTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : undefined;
    return (
      <Screen style={styles.center}>
        <View style={styles.rewardWrap}>
          <View style={styles.rewardTitleRow}>
            <Txt style={styles.rewardTitle}>Profile complete!</Txt>
            <PartyPopper size={22} color={colors.text} />
          </View>
          <Muted style={styles.rewardSub}>
            Here's 10% off (up to ₹100) your next booking{validTill ? ` — valid until ${validTill}` : ''}:
          </Muted>
          <View style={styles.codeBox}>
            <Txt style={styles.codeTxt}>{code}</Txt>
          </View>
          <Muted style={styles.rewardFine}>One-time use — apply it at checkout on your next booking. We've also sent it to you on WhatsApp{user?.email ? ' and email' : ''}.</Muted>
          <Button label="Explore events →" onPress={goHome} style={{ marginTop: spacing.l }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={80} contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <Txt style={styles.h1}>Complete your profile</Txt>
          <Txt style={styles.laterLink} onPress={goHome}>Maybe later</Txt>
        </View>
        <Muted style={styles.sub}>
          Finish these and get 10% off (up to ₹100) your next booking — one-time code, valid for 15 days.
        </Muted>

        {!!err && (
          <View style={styles.errRow}>
            <XCircle size={13} color={colors.danger} />
            <Muted style={styles.errTxt}>{err}</Muted>
          </View>
        )}

        <AvatarUploadBox value={photo || null} onChange={(v) => setPhoto(v ?? '')} onBusyChange={setPhotoUploading} />
        <Muted style={styles.photoHint}>Add a profile picture — it appears on your tickets and reviews</Muted>

        <Txt style={styles.label}>USERNAME *</Txt>
        <TextInput value={username} onChangeText={(v) => { setUsername(v); setUsernameErr(''); }} autoCapitalize="none" placeholderTextColor={colors.muted} style={[styles.input, !!usernameErr && styles.inputErr]} />
        {!!usernameErr && <Muted style={styles.fieldErr}>{usernameErr} — please choose a different one</Muted>}

        <Txt style={styles.label}>DATE OF BIRTH * (DD-MM-YYYY)</Txt>
        <TextInput value={dob} onChangeText={(v) => setDob(autoFormatDobInput(v))} placeholder="20-05-1998" keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} />
        {displayAge != null && <Muted style={styles.ageHint}>Age {displayAge}</Muted>}

        <Txt style={styles.label}>GENDER *</Txt>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />)}
        </View>

        <Txt style={styles.label}>CITY *</Txt>
        <TextInput value={city} onChangeText={setCity} placeholderTextColor={colors.muted} style={styles.input} />
        <Txt style={styles.label}>STATE *</Txt>
        <TextInput value={state} onChangeText={setState} placeholderTextColor={colors.muted} style={styles.input} />
        <Txt style={styles.label}>COUNTRY *</Txt>
        <TextInput value={country} onChangeText={setCountry} placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>PROFESSION *</Txt>
        <TextInput value={profession} onChangeText={setProfession} placeholder="What do you do?" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>LANGUAGES *</Txt>
        <TextInput value={languages} onChangeText={setLanguages} placeholder="English, Hindi…" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>BIO *</Txt>
        <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={4} placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} />

        <Txt style={styles.label}>SOCIAL LINKS * (at least one)</Txt>
        <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />

        <Txt style={styles.label}>INTERESTS * (pick at least one)</Txt>
        <InterestsPicker value={interests} onChange={setInterests} />

        <Button
          label={photoUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save & claim my 10% off →'}
          loading={saving}
          disabled={saving || photoUploading}
          onPress={save}
          style={{ marginTop: spacing.xl }}
        />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.s },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  laterLink: { color: colors.accent, fontSize: fontSize.s, fontFamily: fontFamily.bold },
  sub: { fontSize: fontSize.s, marginTop: 4, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.m },
  errTxt: { color: colors.danger, fontSize: fontSize.s },
  photoHint: { fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.s },
  label: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.muted, marginBottom: spacing.s, marginTop: spacing.l },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.l,
  },
  inputErr: { borderColor: colors.danger },
  fieldErr: { color: colors.danger, fontSize: fontSize.xs, marginTop: 4 },
  ageHint: { fontSize: fontSize.xs, marginTop: 4 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
  rewardWrap: { alignItems: 'center', padding: spacing.xl, maxWidth: 420 },
  rewardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  rewardTitle: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  rewardSub: { textAlign: 'center', marginTop: spacing.s },
  codeBox: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.m, paddingVertical: spacing.l, paddingHorizontal: spacing.xl, marginVertical: spacing.l },
  codeTxt: { fontSize: fontSize.xxl, fontFamily: fontFamily.extrabold, letterSpacing: 1 },
  rewardFine: { fontSize: fontSize.xs, textAlign: 'center' },
});
