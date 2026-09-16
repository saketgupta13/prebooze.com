import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Upload, X } from 'lucide-react-native';
import { Muted } from './ui';
import { organizer } from '../api/organizer';
import { colors, radius, spacing } from '../theme/tokens';

/** RN equivalent of prebooze-web/src/components/RealUploadBox.tsx's
 * RealUploadBox (single image) — real upload via POST /organizer/upload,
 * same endpoint. Web's RealGalleryUploadBox is just this component used in
 * a loop from the wizard (see EventWizardScreen), and RealVideoUploadBox is
 * dropped in favor of web's own "paste a link" fallback path only — picking
 * and uploading a real video file is a materially bigger native surface
 * (progress UI, size limits) not justified for this phase. */
export default function ImageUploadBox({
  value, onChange, onBusyChange, width, height, label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  width: number;
  height: number;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setErr('');
    setUploading(true);
    onBusyChange?.(true);
    try {
      const name = asset.fileName ?? `upload-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const res = await organizer.upload(asset.uri, name, mimeType);
      onChange(res.url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <View>
      <Pressable style={[styles.box, { width, height }]} onPress={pick} disabled={uploading}>
        {value ? (
          <>
            <Image source={{ uri: value }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable style={styles.removeBtn} onPress={() => onChange(null)}>
              <X size={13} color="#fff" />
            </Pressable>
          </>
        ) : uploading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Upload size={18} color={colors.muted} />
            <Muted style={styles.label}>{label}</Muted>
          </>
        )}
      </Pressable>
      {!!err && <Muted style={styles.err}>{err}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5, borderColor: colors.border3, borderStyle: 'dashed', borderRadius: radius.m,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 6,
  },
  label: { fontSize: 11, textAlign: 'center', paddingHorizontal: spacing.s },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.danger, fontSize: 11, marginTop: 4 },
});
