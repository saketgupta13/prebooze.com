/** Provider configuration for outbound messaging.
 * All values come from environment variables (see .env.example) so the same
 * code runs mock (no env) and production (real providers) without changes. */
export const MESSAGING = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  whatsapp: {
    provider: import.meta.env.VITE_WA_PROVIDER ?? 'aisensy', // aisensy (Meta BSP)
    // AiSensy API key lives server-side only (prebooze-api/.env) — the frontend never holds it
  },
  email: {
    provider: import.meta.env.VITE_EMAIL_PROVIDER ?? 'resend', // resend | ses | sendgrid
    from: import.meta.env.VITE_EMAIL_FROM ?? 'Prebooze <no-reply@prebooze.com>',
  },
};
