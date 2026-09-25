import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/** Real bug fixed 2026-09-25: every CSV "export" across this app
 * (BookingsScreen/TransactionsScreen/PayoutsScreen) called
 * `Share.share({ message: csv, title })` — RN's Share API `message` is
 * plain text, so this just pasted the raw CSV text into whatever app the
 * organizer picked (WhatsApp, email, Notes), never actually creating a
 * `.csv` file. Writes a real file to cache and hands it to the OS share
 * sheet instead, so "Save to Files"/"Open in Sheets"/email-as-attachment
 * all work the way they would on web's real browser download. */
export async function shareCsv(filename: string, csv: string) {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Sharing not available', 'This device can\'t open the share sheet.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
}

/** Same reasoning as shareCsv above, for a real PDF download — see
 * BillingScreen.tsx's invoice downloads. downloadAsync carries the auth
 * header directly (no manual fetch+base64 conversion needed) since the
 * PDF endpoint is JWT-gated, same as every other organizer-console call. */
export async function downloadAndSharePdf(url: string, filename: string, authHeader: string) {
  const uri = FileSystem.cacheDirectory + filename;
  const result = await FileSystem.downloadAsync(url, uri, { headers: { Authorization: authHeader } });
  if (result.status !== 200) throw new Error(`Download failed (${result.status})`);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Sharing not available', 'This device can\'t open the share sheet.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
}
