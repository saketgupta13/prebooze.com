import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';
import type { SocialLinks } from '../types';

const SOCIAL_PLATFORMS: { key: Exclude<keyof SocialLinks, 'other'>; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/username' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'x.com/username' },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'snapchat.com/add/username' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'tiktok.com/@username' },
];

/** Same expandable platform list as web's EditProfile.tsx/FinishProfile.tsx
 * (only Instagram shown by default, "+ Add another" reveals the rest, or a
 * platform with an existing value always shows). */
export default function SocialLinksEditor({ value, onChange }: { value: SocialLinks; onChange: (v: SocialLinks) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = SOCIAL_PLATFORMS.filter((p, i) => i === 0 || showAll || (value[p.key] ?? '').trim());
  const hiddenCount = SOCIAL_PLATFORMS.length - visible.length;

  return (
    <View>
      {visible.map((p) => (
        <View key={p.key} style={{ marginBottom: spacing.s }}>
          <Txt style={styles.platformLabel}>{p.label}</Txt>
          <TextInput
            value={value[p.key] ?? ''}
            onChangeText={(v) => onChange({ ...value, [p.key]: v })}
            placeholder={p.placeholder}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
      ))}
      {hiddenCount > 0 && (
        <Button label="+ Add another social link" variant="ghost" onPress={() => setShowAll(true)} style={{ alignSelf: 'flex-start', marginTop: spacing.xs }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  platformLabel: { fontSize: fontSize.xs, color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m,
  },
});
