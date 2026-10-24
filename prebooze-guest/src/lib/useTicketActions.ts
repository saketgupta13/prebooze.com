import { useRef } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { buildIcs } from './bookingDisplay';
import type { Booking } from '../types';

/** Shared "Download ticket" (real standalone ticket image, via TicketView +
 * react-native-view-shot) / "Add to calendar" (.ics file share) actions —
 * used by both BookingConfirmedScreen and the My Bookings detail screen so
 * the two never implement this twice. The caller renders <TicketView
 * ref={ticketRef} booking={booking} /> off-screen somewhere in its tree. */
export function useTicketActions(booking: Booking | null) {
  const ticketRef = useRef<View>(null);

  const downloadTicket = async () => {
    if (!ticketRef.current || !booking) return;
    try {
      // captureRef's own tmp file has a meaningless auto-generated name
      // (e.g. a UUID with no extension context) — sharing that directly
      // meant the file arrived with a generic/blank-looking name in Gmail
      // and other apps' attachment lists. Copy it to a properly named file
      // first, same convention web's lib/ticket.ts download filename uses,
      // so every app that receives it (email, Drive, Files, WhatsApp...)
      // shows a real "prebooze-ticket-TKT-XXXXX.png" name.
      const tmpUri = await captureRef(ticketRef, { format: 'png', quality: 1 });
      const named = new File(Paths.cache, `prebooze-ticket-${booking.id.replace(/[^\w-]/g, '')}.png`);
      if (named.exists) named.delete();
      await new File(tmpUri).copy(named);
      await Sharing.shareAsync(named.uri, { mimeType: 'image/png', dialogTitle: 'Save your ticket' });
    } catch {
      Alert.alert("Couldn't save ticket", 'Please try again.');
    }
  };

  const addToCalendar = async () => {
    const event = booking?.event;
    if (!event) return;
    try {
      const file = new File(Paths.cache, `${event.slug}.ics`);
      if (file.exists) file.delete();
      file.create();
      file.write(buildIcs(event));
      await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', dialogTitle: 'Add to calendar' });
    } catch {
      Alert.alert("Couldn't create calendar file", 'Please try again.');
    }
  };

  return { ticketRef, downloadTicket, addToCalendar };
}
