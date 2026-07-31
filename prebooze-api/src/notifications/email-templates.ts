/** Every transactional email template's *default* copy lives here as data
 * (id, subject, body — plain {{token}} placeholders, never executable code),
 * rendered by the pure `renderTemplate()` function. An admin-edited row in
 * the EmailTemplate table (see EmailService.sendTemplate) overrides subject/
 * bodyHtml for a given id; everything else (layout, logo, CTA wiring) always
 * comes from code. Substitution is plain string replace — there is no eval,
 * so an admin can only ever change wording/formatting, never inject script,
 * regardless of what they type into the editor. */

const GREEN = '#8bc34a';
const BG = '#0e0f0a';
const CARD = '#171911';
const TEXT = '#f1f3ea';
const MUTED = '#9a9d8c';

function layout(preheader: string, bodyHtml: string, cta?: { label: string; url: string }, logoUrl?: string | null): string {
  const webUrl = process.env.WEB_APP_URL || 'https://prebooze.com';
  const logo = logoUrl?.trim() || `${webUrl}/prebooze-logo.png`;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:${CARD};border:1px solid rgba(139,195,74,.18);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px 0;">
          <img src="${logo}" alt="Prebooze" height="28" style="height:28px;width:auto;display:block;" />
        </td></tr>
        <tr><td style="padding:20px 28px 8px;color:${TEXT};font-size:14px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        ${cta ? `<tr><td style="padding:8px 28px 24px;">
          <a href="${cta.url}" style="display:inline-block;background:${GREEN};color:#0e0f0a;font-weight:700;font-size:13px;text-decoration:none;padding:11px 20px;border-radius:8px;">${cta.label}</a>
        </td></tr>` : '<tr><td style="height:16px;"></td></tr>'}
        <tr><td style="padding:16px 28px 24px;border-top:1px solid rgba(139,195,74,.12);">
          <div style="color:${MUTED};font-size:11px;line-height:1.6;">
            Prebooze · your city's events, one tap away<br/>
            <a href="${webUrl}" style="color:${MUTED};">${webUrl.replace(/^https?:\/\//, '')}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const KYC_ROLE_LABEL: Record<string, string> = {
  organizer: 'organizer', promoter: 'promoter', lineup: 'line-up/artist', venue: 'venue partner',
};

export interface TemplateOverride {
  subject: string;
  bodyHtml: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  category: 'Guest' | 'Roles' | 'Admin';
  trigger: string;
  preheader: string;
  defaultSubject: string;
  defaultBody: string;
  cta?: { label: string; urlTemplate: string };
  tokens: string[]; // documents what {{...}} placeholders this template actually receives — shown in the admin editor
}

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: 'welcome', name: 'Welcome', category: 'Guest',
    trigger: 'Guest sets an email on their profile for the first time',
    preheader: 'Your account is ready',
    defaultSubject: 'Welcome to Prebooze 🎉',
    defaultBody: `<p>Hey {{name}},</p><p>You're in. Browse what's on tonight, follow your favourite organizers and promoters, and check in with a QR at the door — no printing, no hassle.</p>`,
    cta: { label: 'Browse events →', urlTemplate: '{{webUrl}}/browse' },
    tokens: ['name'],
  },
  {
    id: 'phone_number_changed', name: 'Login phone number changed', category: 'Guest',
    trigger: 'AuthService.confirmPhoneChange — a self-serve login-number change is completed',
    preheader: 'Your login number was updated',
    defaultSubject: 'Your Prebooze login number changed',
    defaultBody: `<p>Hey {{name}},</p><p>Your Prebooze login number was just changed to <b>{{newPhone}}</b>. If that wasn't you, contact support right away — your old number no longer works for OTP login on this account.</p>`,
    tokens: ['name', 'newPhone'],
  },
  {
    id: 'booking_confirmed', name: 'Booking confirmed', category: 'Guest',
    trigger: 'A booking is created and payment succeeds',
    preheader: 'Your tickets are confirmed',
    defaultSubject: 'Booked ✓ {{eventTitle}}',
    defaultBody: `<p>Hey {{name}},</p><p>Your booking for <b>{{eventTitle}}</b> is confirmed.</p>
      <table role="presentation" width="100%" style="margin:12px 0;font-size:13px;">
        <tr><td style="color:${MUTED};padding:4px 0;">Booking ID</td><td align="right">{{bookingId}}</td></tr>
        <tr><td style="color:${MUTED};padding:4px 0;">Tickets</td><td align="right">{{qty}}</td></tr>
        <tr><td style="color:${MUTED};padding:4px 0;">Paid</td><td align="right">{{total}}</td></tr>
      </table>
      <p style="color:${MUTED};">Your QR ticket is in the app under My tickets — show it at the door.</p>`,
    cta: { label: 'View my ticket →', urlTemplate: '{{webUrl}}/my-events' },
    tokens: ['name', 'eventTitle', 'bookingId', 'qty', 'total'],
  },
  {
    id: 'refund_requested', name: 'Refund requested', category: 'Guest',
    trigger: 'Guest requests a refund to their original payment source',
    preheader: 'We got your refund request',
    defaultSubject: 'Refund requested — {{bookingId}}',
    defaultBody: `<p>Hey {{name}},</p><p>We've received your refund request for booking <b>{{bookingId}}</b> ({{amount}}). Our team reviews these — you'll get another email the moment it's approved.</p>`,
    tokens: ['name', 'bookingId', 'amount'],
  },
  {
    id: 'refund_processed', name: 'Refund processed', category: 'Guest',
    trigger: 'Admin approves a refund, or an instant wallet refund completes',
    preheader: 'Your refund is on its way',
    defaultSubject: 'Refunded ✓ {{bookingId}}',
    defaultBody: `<p>Hey {{name}},</p><p><b>{{amount}}</b> for booking <b>{{bookingId}}</b> has been refunded {{refundNote}}</p>`,
    tokens: ['name', 'bookingId', 'amount', 'refundNote'],
  },
  {
    id: 'waitlist_offer', name: 'Waitlist spot opened', category: 'Guest',
    trigger: 'A refund frees a spot and the FIFO waitlist offers it to the next guest',
    preheader: 'Your waitlisted event has a spot free',
    defaultSubject: 'A spot opened up — {{eventTitle}}',
    defaultBody: `<p>Hey {{name}},</p><p>A ticket just freed up for <b>{{eventTitle}}</b>, and you're first on the waitlist. Grab it before it's gone.</p>`,
    cta: { label: 'Book now →', urlTemplate: '{{eventUrl}}' },
    tokens: ['name', 'eventTitle', 'eventUrl'],
  },
  {
    id: 'cart_reminder', name: 'Abandoned cart reminder', category: 'Guest',
    trigger: 'Admin (or an organizer) sends a nudge from Abandoned carts',
    preheader: 'Your tickets are waiting',
    defaultSubject: "Still want in? {{eventTitle}}",
    defaultBody: `<p>Hey {{name}},</p><p>You were this close to booking <b>{{eventTitle}}</b> — your spot isn't held forever. Finish up before it sells out.</p>`,
    cta: { label: 'Complete booking →', urlTemplate: '{{eventUrl}}' },
    tokens: ['name', 'eventTitle', 'eventUrl'],
  },
  {
    id: 'review_request', name: 'Post-event review request', category: 'Guest',
    trigger: 'CronService.reviewRequestTick — a day after an attended, confirmed booking\'s event ends',
    preheader: 'How was it? Leave a quick review',
    defaultSubject: 'How was {{eventTitle}}?',
    defaultBody: `<p>Hey {{name}},</p><p>Hope <b>{{eventTitle}}</b> by {{organizerName}} was a good one. Got a minute to rate it and leave a review? It helps other guests decide, and helps {{organizerName}} know what worked.</p>`,
    cta: { label: 'Write a review →', urlTemplate: '{{webUrl}}/organizers/{{organizerId}}' },
    tokens: ['name', 'eventTitle', 'organizerName', 'organizerId'],
  },
  {
    id: 'referral_welcome', name: 'Referral welcome credit', category: 'Guest',
    trigger: "A new guest claims a friend's referral code",
    preheader: 'Your referral welcome credit landed',
    defaultSubject: '{{amount}} wallet credit — welcome!',
    defaultBody: `<p>Hey {{name}},</p><p>Thanks for joining via a friend's link — <b>{{amount}}</b> is already in your Prebooze wallet, ready to use on your next booking.</p>`,
    tokens: ['name', 'amount'],
  },
  {
    id: 'referral_reward', name: 'Referral reward earned', category: 'Guest',
    trigger: 'A referred friend completes their first paid booking',
    preheader: 'Your friend just booked their first event',
    defaultSubject: '{{amount}} referral reward earned 🎉',
    defaultBody: `<p>Hey {{name}},</p><p>{{friendName}} made their first booking through your referral link — <b>{{amount}}</b> just landed in your wallet.</p>`,
    tokens: ['name', 'amount', 'friendName'],
  },
  {
    id: 'profile_reward', name: 'Profile completion reward', category: 'Guest',
    trigger: 'Guest finishes the "complete your profile" step',
    preheader: 'Your 10% off code is ready',
    defaultSubject: '🎉 10% off your next booking — code inside',
    defaultBody: `<p>Hey {{name}},</p><p>Thanks for finishing your profile! Here's <b>10% off (up to ₹100)</b> your next booking on Prebooze:</p><p style="font-size:20px;font-weight:800;letter-spacing:1px;margin:16px 0;">{{code}}</p><p>Valid until <b>{{validTill}}</b> — one-time use.</p>`,
    cta: { label: 'Browse events →', urlTemplate: '{{webUrl}}/browse' },
    tokens: ['name', 'code', 'validTill'],
  },
  {
    id: 'help_ticket', name: 'Support ticket received', category: 'Guest',
    trigger: 'A guest, organizer or promoter raises a help ticket',
    preheader: 'Support ticket received',
    defaultSubject: "We've got your message — {{ticketId}}",
    defaultBody: `<p>Hey {{name}},</p><p>Your message "<b>{{ticketSubject}}</b>" has been logged as <b>{{ticketId}}</b>. Our team typically replies within a few hours.</p>`,
    tokens: ['name', 'ticketId', 'ticketSubject'],
  },
  {
    id: 'contact_form_received', name: 'Contact form received', category: 'Guest',
    trigger: 'The public Contact-us page form is submitted (no login required)',
    preheader: 'We got your message',
    defaultSubject: "We've got your message — {{ticketId}}",
    defaultBody: `<p>Hey {{name}},</p><p>Thanks for reaching out — your message has been logged as <b>{{ticketId}}</b>. Our team typically replies within a day.</p>`,
    tokens: ['name', 'ticketId'],
  },
  {
    id: 'kyc_pending', name: 'Application received', category: 'Roles',
    trigger: 'Applicant submits an organizer / promoter / venue / line-up application',
    preheader: 'Your application is being reviewed',
    defaultSubject: "We've got your {{roleLabel}} application",
    defaultBody: `<p>Hey {{name}},</p><p>Thanks for applying as a {{roleLabel}} on Prebooze. Our team reviews these by hand — you'll get an email the moment it's approved (or if we need anything else from you).</p>`,
    tokens: ['name', 'roleLabel'],
  },
  {
    id: 'kyc_approved', name: 'KYC approved', category: 'Roles',
    trigger: 'Admin approves an organizer / promoter / venue / line-up application',
    preheader: 'Your application was approved',
    defaultSubject: "You're approved as a {{roleLabel}} on Prebooze ✓",
    defaultBody: `<p>Hey {{name}},</p><p>Good news — your {{roleLabel}} application is approved. Your console is live now.</p>`,
    cta: { label: 'Open your console →', urlTemplate: '{{webUrl}}/dashboard' },
    tokens: ['name', 'roleLabel'],
  },
  {
    id: 'kyc_rejected', name: 'KYC rejected', category: 'Roles',
    trigger: 'Admin rejects a role application, with a reason',
    preheader: 'Your application needs another look',
    defaultSubject: 'Update on your {{roleLabel}} application',
    defaultBody: `<p>Hey {{name}},</p><p>Your {{roleLabel}} application wasn't approved this time.</p>{{reasonBlock}}<p style="color:${MUTED};">You're welcome to fix the above and reapply any time.</p>`,
    tokens: ['name', 'roleLabel', 'reasonBlock'],
  },
  {
    id: 'event_approved', name: 'Event approved', category: 'Roles',
    trigger: 'Admin approves an organizer-submitted event (AdminEventsController.approve)',
    preheader: 'Your event is live',
    defaultSubject: '"{{eventTitle}}" is approved and live ✓',
    defaultBody: `<p>Hey {{name}},</p><p>Good news — <b>{{eventTitle}}</b> is approved and now live on Prebooze. Guests can find and book it right away.</p>`,
    cta: { label: 'View your event →', urlTemplate: '{{webUrl}}/events/{{eventSlug}}' },
    tokens: ['name', 'eventTitle', 'eventSlug'],
  },
  {
    id: 'event_rejected', name: 'Event rejected', category: 'Roles',
    trigger: 'Admin rejects an organizer-submitted event, with a reason',
    preheader: 'Your event needs another look',
    defaultSubject: 'Update on "{{eventTitle}}"',
    defaultBody: `<p>Hey {{name}},</p><p><b>{{eventTitle}}</b> wasn't approved this time.</p>{{reasonBlock}}<p style="color:${MUTED};">Fix the above and resubmit any time from your organizer console.</p>`,
    tokens: ['name', 'eventTitle', 'reasonBlock'],
  },
  {
    id: 'org_team_invite', name: 'Organizer team invite', category: 'Roles',
    trigger: 'An organizer invites a team member (OrgTeamService.addStaff)',
    preheader: "You've been added to a Prebooze team",
    defaultSubject: '{{orgBrand}} added you to their Prebooze team ✓',
    defaultBody: `<p>Hey {{name}},</p><p><b>{{orgBrand}}</b> added you to their team on Prebooze as <b>{{roleName}}</b>. Log in with your phone number ({{phone}}) to get started — you'll see exactly what your role gives you access to.</p>`,
    cta: { label: 'Log in →', urlTemplate: '{{webUrl}}/login' },
    tokens: ['name', 'orgBrand', 'roleName', 'phone'],
  },
  {
    id: 'payout_processed', name: 'Payout processed', category: 'Roles',
    trigger: 'An organizer or promoter withdraws their balance',
    preheader: 'Your withdrawal was processed',
    defaultSubject: 'Payout sent — {{amount}}',
    defaultBody: `<p>Hey {{name}},</p><p><b>{{amount}}</b> is on its way to your bank account. As an active {{role}} on Prebooze, thanks for hosting with us.</p>`,
    tokens: ['name', 'amount', 'role'],
  },
  {
    id: 'subscription_activated', name: 'Subscription activated', category: 'Roles',
    trigger: 'A Razorpay subscription is authorized and the paid plan takes effect',
    preheader: 'Your plan is now active',
    defaultSubject: '{{planName}} plan is active — welcome aboard',
    defaultBody: `<p>Hey {{name}},</p><p>Your <b>{{planName}}</b> plan ({{amount}}/month) is now active. You'll be billed automatically each month — cancel anytime from your dashboard.</p>`,
    cta: { label: 'Open my dashboard →', urlTemplate: '{{webUrl}}/dashboard' },
    tokens: ['name', 'planName', 'amount'],
  },
  {
    id: 'subscription_payment_failed', name: 'Subscription payment failed', category: 'Roles',
    trigger: 'A recurring subscription charge fails and Razorpay halts the subscription',
    preheader: "We couldn't renew your plan",
    defaultSubject: "Payment failed — your {{planName}} plan needs attention",
    defaultBody: `<p>Hey {{name}},</p><p>We couldn't renew your <b>{{planName}}</b> plan — your account has been moved to the free plan until this is fixed. Update your payment method to restore it.</p>`,
    cta: { label: 'Fix billing →', urlTemplate: '{{webUrl}}/dashboard' },
    tokens: ['name', 'planName'],
  },
  {
    id: 'featured_expired_reminder', name: 'Featured placement expired', category: 'Roles',
    trigger: 'Admin sends a manual reminder for a lapsed Featured placement (Admin > Featured > Expired tab)',
    preheader: 'Your featured placement has expired',
    defaultSubject: 'Your featured placement for {{itemLabel}} has expired',
    defaultBody: `<p>Hey {{name}},</p><p>Your featured placement for <b>{{itemLabel}}</b> ended on {{expiredOn}}. Renew it to keep showing up in the featured spots guests see first.</p>`,
    cta: { label: 'Renew featured placement →', urlTemplate: '{{webUrl}}/dashboard' },
    tokens: ['name', 'itemLabel', 'expiredOn'],
  },
  {
    id: 'featured_expiring_soon', name: 'Featured placement expiring soon', category: 'Roles',
    trigger: 'Automatic — daily cron, fires once when an active Featured placement is within 3 days of expiry',
    preheader: 'Your featured placement expires in 3 days',
    defaultSubject: 'Your featured placement for {{itemLabel}} expires in 3 days',
    defaultBody: `<p>Hey {{name}},</p><p>Your featured placement for <b>{{itemLabel}}</b> expires on <b>{{expiresOn}}</b> — just a heads up so you can renew before it drops out of the featured spots guests see first.</p>`,
    cta: { label: 'Renew featured placement →', urlTemplate: '{{webUrl}}/dashboard' },
    tokens: ['name', 'itemLabel', 'expiresOn'],
  },
  {
    id: 'featured_submitted', name: 'Featured request received', category: 'Roles',
    trigger: 'An organizer/promoter/venue/line-up submits a Featured placement request',
    preheader: 'Your featured placement is in review',
    defaultSubject: 'Featured request received — {{itemLabel}}',
    defaultBody: `<p>Hey {{name}},</p><p>Your request to feature <b>{{itemLabel}}</b> ({{amount}}) is with our team for approval — you'll hear back shortly.</p>`,
    tokens: ['name', 'itemLabel', 'amount'],
  },
  {
    id: 'staff_invite', name: 'Staff invite', category: 'Admin',
    trigger: 'Owner adds a new staff member under Staff & roles',
    preheader: 'Your staff login is ready',
    defaultSubject: "You've been added to the Prebooze admin panel",
    defaultBody: `<p>Hey {{name}},</p><p>You've been added as <b>{{roleName}}</b> on the Prebooze admin panel. Sign in with this temporary password, then change it from your profile:</p><p style="background:rgba(139,195,74,.08);border:1px solid rgba(139,195,74,.25);border-radius:8px;padding:10px 12px;font-family:monospace;font-size:15px;letter-spacing:1px;">{{tempPassword}}</p>`,
    cta: { label: 'Sign in →', urlTemplate: '{{adminUrl}}/login' },
    tokens: ['name', 'roleName', 'tempPassword'],
  },
  {
    id: 'staff_2fa_code', name: 'Staff 2FA code', category: 'Admin',
    trigger: 'A staff member signs in while "Require 2FA for team sign-in" is on in Settings',
    preheader: 'Your sign-in code',
    defaultSubject: 'Your Prebooze admin sign-in code: {{code}}',
    defaultBody: `<p>Hey {{name}},</p><p>Enter this code to finish signing in to the Prebooze admin panel. It expires in 5 minutes.</p><p style="background:rgba(139,195,74,.08);border:1px solid rgba(139,195,74,.25);border-radius:8px;padding:14px;font-family:monospace;font-size:24px;letter-spacing:6px;text-align:center;">{{code}}</p><p style="color:${MUTED};">Didn't try to sign in? Change your password and contact the Owner.</p>`,
    tokens: ['name', 'code'],
  },
  {
    id: 'job_application', name: 'Job application received', category: 'Admin',
    trigger: 'Someone applies to an open role on the Careers page',
    preheader: 'Application received',
    defaultSubject: "We've got your application — {{jobTitle}}",
    defaultBody: `<p>Hey {{name}},</p><p>Thanks for applying to <b>{{jobTitle}}</b> at Prebooze. Our team reviews every application — we'll reach out if it's a fit.</p>`,
    tokens: ['name', 'jobTitle'],
  },
  {
    id: 'weekly_summary', name: 'Weekly summary (owner)', category: 'Admin',
    trigger: 'Weekly, if "Weekly summary email" is on in Settings — needs the cron job slice, not yet scheduled',
    preheader: 'Your weekly platform summary',
    defaultSubject: 'Prebooze weekly summary — {{periodLabel}}',
    defaultBody: `<p>Hey {{ownerName}},</p><p>Here's how the platform did this week:</p>
      <table role="presentation" width="100%" style="margin:12px 0;font-size:13px;">
        <tr><td style="color:${MUTED};padding:4px 0;">Gross revenue</td><td align="right">{{revenue}}</td></tr>
        <tr><td style="color:${MUTED};padding:4px 0;">Bookings</td><td align="right">{{bookings}}</td></tr>
        <tr><td style="color:${MUTED};padding:4px 0;">Payouts due</td><td align="right">{{payoutsDue}}</td></tr>
      </table>`,
    cta: { label: 'Open admin panel →', urlTemplate: '{{adminUrl}}' },
    tokens: ['ownerName', 'revenue', 'bookings', 'payoutsDue', 'periodLabel'],
  },
  {
    id: 'invoice', name: 'Invoice', category: 'Admin',
    trigger: 'A booking or featured-placement invoice is issued, or resent from admin',
    preheader: 'Your invoice from Prebooze',
    defaultSubject: 'Your Prebooze invoice — {{invoiceNumber}}',
    defaultBody: `<p>Hey {{name}},</p><p>Your invoice <b>{{invoiceNumber}}</b> for {{description}} is attached as a PDF — total <b>{{total}}</b>.</p>`,
    tokens: ['name', 'invoiceNumber', 'description', 'total'],
  },
];

function substitute(tpl: string, data: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '');
}

/** Pure — no I/O. DB override lookup happens in EmailService.sendTemplate,
 * which then calls this with whatever override row (or none) it found.
 * Custom templates (admin-created, `id` not in TEMPLATE_DEFS) have no code
 * default at all — the override row *is* the entire template, so it's the
 * only required input for those; a custom id with no override is a real
 * error (nothing to render), unlike a fixed id with no override (falls back
 * to the code default). */
export function renderTemplate(id: string, data: Record<string, string>, override?: TemplateOverride | null, logoUrl?: string | null) {
  const def = TEMPLATE_DEFS.find((t) => t.id === id);
  const fullData: Record<string, string> = {
    webUrl: process.env.WEB_APP_URL || 'https://prebooze.com',
    adminUrl: process.env.ADMIN_APP_URL || '',
    ...data,
  };
  if (!def) {
    if (!override) throw new Error(`Unknown email template "${id}"`);
    return { subject: substitute(override.subject, fullData), html: layout('', substitute(override.bodyHtml, fullData), undefined, logoUrl) };
  }
  const subject = substitute(override?.subject || def.defaultSubject, fullData);
  const body = substitute(override?.bodyHtml || def.defaultBody, fullData);
  const cta = def.cta ? { label: def.cta.label, url: substitute(def.cta.urlTemplate, fullData) } : undefined;
  return { subject, html: layout(def.preheader, body, cta, logoUrl) };
}
