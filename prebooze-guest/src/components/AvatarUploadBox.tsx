import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Muted } from './ui';
import { auth } from '../api/auth';
import { colors, radius, spacing } from '../theme/tokens';

/** RN equivalent of prebooze-web's RealUploadBox used for the guest avatar —
 * real upload via POST /me/upload, same as prebooze-organizer's identical
 * ImageUploadBox pattern (auth.upload reuses that exact Blob-via-fetch fix,
 * see its own doc comment). Circular, avatar-sized, not the rectangular
 * event-poster box organizer uses. */
export default function AvatarUploadBox({ value, onChange, onBusyChange, size = 96 }: {
  value: string | null;
  onChange: (url: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  size?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setErr('');
    setUploading(true);
    onBusyChange?.(true);
    try {
      const name = asset.fileName ?? `avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const res = await auth.upload(asset.uri, name, mimeType);
      onChange(res.url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {/* The badge is a sibling of the clipped circle, not a child of it —
       * it used to be positioned inside the same `overflow: 'hidden'` View
       * that clips the avatar image to a circle, which clipped the badge
       * itself too (it sat right at the circle's edge). This outer
       * `size`-boxed wrapper has no overflow clipping, so the badge can
       * overhang the circle's edge and still render. */}
      <Pressable style={{ width: size, height: size }} onPress={pick} disabled={uploading}>
        <View style={[styles.box, { width: size, height: size, borderRadius: size / 2 }]}>
          {value ? (
            <Image source={{ uri: value }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : uploading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Camera size={22} color={colors.muted} />
          )}
        </View>
        <View style={styles.badge}>
          <Camera size={12} color={colors.onAccent} />
        </View>
      </Pressable>
      {!!err && <Muted style={styles.err}>{err}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.border3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  err: { color: colors.danger, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
});
