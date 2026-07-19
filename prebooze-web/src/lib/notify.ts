/** Messaging layer — WhatsApp + email templates for every platform event.
 * In mock mode every send is written to a persisted outbox (pb_outbox); when
 * VITE_API_URL is set the same calls POST to the backend notification service. */
import { MESSAGING } from '../config/messaging';

export type Channel = 'whatsapp' | 'email';

export interface OutboxMessage {
  id: string;
  channel: Channel;
  to: string; // phone for whatsapp, email for email
  template: TemplateId;
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'queued';
}

type Tmpl = (d: Record<string, string>) => { subject: string; body: string };

export const TEMPLATES = {
  welcome: (d) => ({
    subject: 'Welcome to Prebooze 🎉',
    body: `Hey ${d.name || 'there'}! Your Prebooze account is live. Find your city's best nights — tickets land right here on WhatsApp.`,
  }),
  otp: (d) => ({ subject: 'Your Prebooze login code', body: `Your OTP is ${d.code}. Valid for 5 minutes — never share it.` }),
  booking_confirmed: (d) => ({
    subject: `Booking confirmed — ${d.event} ✓`,
    body: `You're in, ${d.name}! ${d.qty}× ${d.event} · ${d.id}. Your QR ticket is attached — scan at entry. Paid ₹${d.total}.`,
  }),
  refund_wallet: (d) => ({
    subject: `Refund credited — ₹${d.amount} 👛`,
    body: `Your booking ${d.id} was cancelled. ₹${d.amount} was instantly credited to your Prebooze wallet.`,
  }),
  refund_source: (d) => ({
    subject: `Refund initiated — ₹${d.amount}`,
    body: `Your booking ${d.id} was cancelled. ₹${d.amount} is on its way to your payment method (5–7 business days).`,
  }),
  subscription_receipt: (d) => ({
    subject: `Subscription active — ${d.plan} ✓`,
    body: `Your ${d.plan} plan is live (₹${d.price}/mo). Quota: ${d.quota} guests/month.`,
  }),
  auto_renew_on: (d) => ({
    subject: 'Auto-renew enabled 🔄',
    body: `Auto-renew is on — your ${d.what} renews automatically from ${d.method || 'your default payment method'}.`,
  }),
  waitlist_offer: (d) => ({
    subject: `A spot opened up — ${d.event} 🎉`,
    body: `${d.name}, a ticket just freed up for ${d.event}! First come, first served — book now: ${d.link}`,
  }),
  referral_welcome: (d) => ({
    subject: '₹' + d.amount + ' welcome credit 🎁',
    body: `Welcome! Your friend's referral gave you ₹${d.amount} Prebooze credit — it auto-applies on your first booking.`,
  }),
  referral_reward: (d) => ({
    subject: `You earned ₹${d.amount} 🎁`,
    body: `${d.friend} just made their first booking — ₹${d.amount} referral reward landed in your wallet.`,
  }),
  featured_submitted: (d) => ({
    subject: 'Featured request received ⭐',
    body: `Payment of ₹${d.amount} received for featuring ${d.what}. An admin reviews it before it goes live (usually within a day).`,
  }),
  help_ticket: (d) => ({
    subject: `Ticket ${d.id} received 🛟`,
    body: `We got your ticket "${d.subject}" (${d.topic}). The team usually replies within a few hours — right here.`,
  }),
  organizer_payout: (d) => ({
    subject: `Payout processed — ₹${d.amount} 💸`,
    body: `Your withdrawal of ₹${d.amount} is processing. It lands in your bank account within 24h (UTR follows).`,
  }),
} satisfies Record<string, Tmpl>;

export type TemplateId = keyof typeof TEMPLATES;

const OUTBOX_KEY = 'pb_outbox';

export function getOutbox(): OutboxMessage[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function push(msg: OutboxMessage) {
  const box = getOutbox();
  box.unshift(msg);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(box.slice(0, 200)));
}

/** Send one message on one channel. Mock mode → outbox; backend mode → API. */
export function sendMessage(channel: Channel, to: string, template: TemplateId, data: Record<string, string> = {}): OutboxMessage {
  const { subject, body } = TEMPLATES[template](data);
  const msg: OutboxMessage = {
    id: 'msg' + Date.now() + Math.random().toString(36).slice(2, 5),
    channel,
    to,
    template,
    subject,
    body,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };
  push(msg);
  if (MESSAGING.apiUrl) {
    // real transport — fire and forget; backend fans out via the configured providers
    fetch(`${MESSAGING.apiUrl}/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, to, template, data }),
    }).catch(() => {});
  }
  return msg;
}

/** Fan out to WhatsApp (phone) and, when available, email. */
export function notify(phone: string, template: TemplateId, data: Record<string, string> = {}, email?: string) {
  sendMessage('whatsapp', phone, template, data);
  if (email) sendMessage('email', email, template, data);
}
