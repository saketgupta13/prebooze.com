/** Design tokens ported 1:1 from prebooze-web/src/index.css (dark theme).
 * Keep in sync if the web app's tokens ever change. */
export const colors = {
  bg: '#1a1c17',
  surface: '#20221a',
  surface2: '#24261d',
  border: 'rgba(255,255,255,0.09)',
  border2: '#2c2e24',
  border3: '#34362a',
  borderDash: 'rgba(255,255,255,0.14)',
  text: '#edefe6',
  muted: '#9a9d8c',
  muted2: '#8d9080',
  accent: '#9be13d',
  onAccent: '#14150f',
  danger: '#ff5c49',
  success: '#1f8a5b',
  // New here, not ported from web (no equivalent token exists there) —
  // added for the Notice component's warning tone, same amber already used
  // ad hoc for the review-star icon in NotificationsScreen.
  warning: '#f5c04a',
  whatsapp: '#25d366',
  shadow: 'rgba(0,0,0,0.45)',
} as const;

export const radius = {
  s: 8,
  m: 10,
  l: 14,
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
} as const;

export const fontFamily = {
  regular: 'Manrope_500Medium',
  medium: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const fontSize = {
  xs: 12,
  s: 13,
  m: 14,
  l: 16,
  xl: 18,
  xxl: 22,
  display: 28,
} as const;
