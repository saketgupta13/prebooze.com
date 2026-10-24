import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BadgeCheck, XCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../api/auth';
import { ApiError } from '../../api/client';
import { htmlToPlainText, plainTextToHtml } from '../../lib/richtext';
import { ageFromDob } from '../../lib/ageGate';
import { autoFormatDobInput, displayDobToIso, isoToDisplayDob } from '../../lib/dob';
import { Button, Chip, IconButton, Muted, Screen, Txt } from '../../components/ui';
import AvatarUploadBox from '../../components/AvatarUploadBox';
import SocialLinksEditor from '../../components/SocialLinksEditor';
import InterestsPicker from '../../components/InterestsPicker';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { SocialLinks } from '../../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

/** Mirrors web's EditProfile.tsx field-for-field — real photo upload, DOB,
 * email, profession, languages, socials, interests, phone-change, Aadhaar
 * indicator. (Only name/username/city/gender/bio existed here before.) */
export default function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [dob, setDob] = useState(isoToDisplayDob(user?.dob ?? ''));
  const [gender, setGender] = useState(user?.gender ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [country, setCountry] = useState(user?.country ?? 'India');
  const [pincode, setPincode] = useState(user?.pincode ?? '');
  const [profession, setProfession] = useState(user?.profession ?? '');
  const [languages, setLanguages] = useState(user?.languages ?? '');
  const [bio, setBio] = useState(htmlToPlainText(user?.bio ?? ''));
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user?.socialLinks ?? {});
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [photo, setPhoto] = useState(user?.avatarUrl ?? '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [usernameErr, setUsernameErr] = useState('');

  const dobIso = displayDobToIso(dob);
  const displayAge = (dobIso ? ageFromDob(dobIso) : null) ?? user?.age ?? null;

  const save = async () => {
    setErr('');
    setUsernameErr('');
    if (photoUploading) { setErr('Photo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      await auth.updateMe({
        name: name.trim(), username: username.trim().toLowerCase(), dob: dobIso || undefined, gender, email: email.trim(),
        city: city.trim(), state: state.trim(), country: country.trim(), pincode: pincode.trim(),
        profession: profession.trim(), languages: languages.trim(), bio: plainTextToHtml(bio.trim()),
        interests, avatarUrl: photo || undefined, socialLinks,
      });
      await refreshUser();
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to save profile';
      if (/username/i.test(msg)) setUsernameErr(msg);
      else setErr(msg);
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
        <Txt style={styles.title}>Edit profile</Txt>
        <Button label={saving ? 'Saving…' : 'Save'} loading={saving} disabled={saving || photoUploading} onPress={save} style={styles.saveBtn} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={80} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <XCircle size={13} color={colors.danger} />
            <Muted style={styles.errTxt}>{err}</Muted>
          </View>
        )}

        <AvatarUploadBox value={photo || null} onChange={(v) => setPhoto(v ?? '')} onBusyChange={setPhotoUploading} />

        <Txt style={styles.label}>FULL NAME</Txt>
        <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>USERNAME</Txt>
        <TextInput value={username} onChangeText={(v) => { setUsername(v); setUsernameErr(''); }} autoCapitalize="none" placeholderTextColor={colors.muted} style={[styles.input, !!usernameErr && styles.inputErr]} />
        {!!usernameErr && <Muted style={styles.fieldErr}>{usernameErr} — please choose a different one</Muted>}

        <Txt style={styles.label}>DATE OF BIRTH (DD-MM-YYYY)</Txt>
        <TextInput value={dob} onChangeText={(v) => setDob(autoFormatDobInput(v))} placeholder="20-05-1998" keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} />
        {displayAge != null && <Muted style={styles.ageHint}>Age {displayAge}</Muted>}

        <Txt style={styles.label}>GENDER</Txt>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />)}
        </View>

        <Txt style={styles.label}>EMAIL</Txt>
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>CITY</Txt>
        <TextInput value={city} onChangeText={setCity} placeholderTextColor={colors.muted} style={styles.input} />
        <Txt style={styles.label}>STATE</Txt>
        <TextInput value={state} onChangeText={setState} placeholderTextColor={colors.muted} style={styles.input} />
        <Txt style={styles.label}>COUNTRY</Txt>
        <TextInput value={country} onChangeText={setCountry} placeholderTextColor={colors.muted} style={styles.input} />
        <Txt style={styles.label}>PINCODE</Txt>
        <TextInput value={pincode} onChangeText={setPincode} keyboardType="number-pad" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>PROFESSION</Txt>
        <TextInput value={profession} onChangeText={setProfession} placeholder="What do you do?" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>LANGUAGES</Txt>
        <TextInput value={languages} onChangeText={setLanguages} placeholder="English, Hindi…" placeholderTextColor={colors.muted} style={styles.input} />

        <Txt style={styles.label}>BIO</Txt>
        <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={4} placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} />

        <Txt style={styles.label}>SOCIAL LINKS</Txt>
        <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />

        <Txt style={styles.label}>INTERESTS</Txt>
        <InterestsPicker value={interests} onChange={setInterests} />

        <Txt style={styles.label}>LOGIN</Txt>
        <ChangePhoneNumber />
        {!!user?.idVerified && (
          <View style={styles.aadhaarRow}>
            <Muted style={styles.aadhaarTxt}>Aadhaar verified</Muted>
            <BadgeCheck size={13} color={colors.accent} />
          </View>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s },
  title: { flex: 1, fontSize: fontSize.l, fontFamily: fontFamily.bold },
  saveBtn: { height: 36, paddingHorizontal: spacing.m },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.m },
  errTxt: { color: colors.danger, fontSize: fontSize.s },
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
  aadhaarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.m },
  aadhaarTxt: { fontSize: fontSize.xs },
});
