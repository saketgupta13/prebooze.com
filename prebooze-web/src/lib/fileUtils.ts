/** Every upload widget in the onboarding flows (FileDropBox/GalleryDropBox)
 * stores a base64 data URL, not a File, so it can round-trip through the
 * localStorage draft. Real submissions need an actual File/Blob to send as
 * multipart — this converts back at submit time. */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
