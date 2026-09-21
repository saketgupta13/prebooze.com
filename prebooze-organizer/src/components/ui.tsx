import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps,
  type TextInputProps, type TextProps, type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, AlertTriangle, Check, Info } from 'lucide-react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

// Every screen renders its own header (native stack/tab headers are off
// everywhere, see AppStack/MainTabs), so top content was landing flush
// under the status bar with nothing pushing it down. A spacer child (not a
// merged style property) survives regardless of whatever `padding`/
// `paddingTop` a caller's own `style` prop sets — a merged inset would get
// silently clobbered by e.g. MoreScreen's `padding: spacing.l`.
export function Screen({ style, children, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, style]} {...props}>
      <View style={{ height: insets.top }} />
      {children}
    </View>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function Txt({ style, ...props }: TextProps) {
  return <Text style={[styles.text, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  return <Text style={[styles.text, styles.muted, style]} {...props} />;
}

export function H1({ style, ...props }: TextProps) {
  return <Text style={[styles.text, styles.h1, style]} {...props} />;
}

export function H2({ style, ...props }: TextProps) {
  return <Text style={[styles.text, styles.h2, style]} {...props} />;
}

export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      style={[styles.input, style]}
      placeholderTextColor={colors.muted}
      {...props}
    />
  );
});

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger' | 'accentOutline';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, variant = 'primary', loading, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      style={(state) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        variant === 'accentOutline' && styles.btnAccentOutline,
        isDisabled && styles.btnDisabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <Text style={[styles.btnLabel, variant === 'primary' && styles.btnLabelPrimary, variant === 'danger' && styles.btnLabelDanger, variant === 'accentOutline' && styles.btnLabelAccentOutline]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// A tappable icon-only square — back buttons, remove/delete rows. `Button`
// only ever renders its `label` text (or a spinner), never children, so
// this is a separate component rather than an overload of it.
export function IconButton({ children, onPress, tone = 'default', style, disabled }: { children: ReactNode; onPress?: () => void; tone?: 'default' | 'danger'; style?: PressableProps['style']; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={(state) => [
        styles.iconBtn,
        tone === 'danger' && styles.iconBtnDanger,
        disabled && styles.btnDisabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'danger' | 'accent' }) {
  return (
    <View style={[styles.badge, tone === 'success' && styles.badgeSuccess, tone === 'danger' && styles.badgeDanger, tone === 'accent' && styles.badgeAccent]}>
      <Text style={[styles.badgeLabel, tone === 'accent' && styles.badgeLabelAccent]}>{label}</Text>
    </View>
  );
}

// A real inline banner for a sentence-length note/warning/error — distinct
// from Badge (a short label pill, never meant for a full sentence) and from
// the tiny errRow pattern duplicated across every screen (icon + plain red
// text, no card, suited to terse validation errors). Added 2026-09-21 after
// EventWizard's "edits resubmit for approval" notice was jammed into a
// Badge and looked wrong — every future full-sentence notice should use
// this instead of reaching for Badge or a one-off inline View.
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'warning' ? AlertTriangle : Info;
  const color = tone === 'error' ? colors.danger : tone === 'warning' ? colors.warning : colors.accent;
  return (
    <View style={[styles.notice, tone === 'error' && styles.noticeError, tone === 'warning' && styles.noticeWarning]}>
      <Icon size={16} color={color} style={styles.noticeIcon} />
      {typeof children === 'string' ? <Txt style={[styles.noticeText, { color }]}>{children}</Txt> : children}
    </View>
  );
}

// Ports web's `.chip`/`.chip.on` — used for the city filter (Dashboard),
// status filter (Bookings) and event picker (Scanner). All three use short
// tappable pill lists instead of a native <select>, which has no good
// mobile-first equivalent.
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

// Bar for KPI/ticket-stat rows — ports web's `.bar` / `.bar > div`.
export function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` }, color ? { backgroundColor: color } : null]} />
    </View>
  );
}

// Ports web's `.kpi` card (Dashboard/GuestList/LiveMonitor all use the same
// label-over-value block).
export function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'accent' }) {
  return (
    <Card style={styles.kpi}>
      <Muted style={[styles.kpiLabel, tone === 'danger' && { color: colors.danger }]}>{label}</Muted>
      <Txt style={[styles.kpiValue, tone === 'danger' && { color: colors.danger }, tone === 'accent' && { color: colors.accent }]}>{value}</Txt>
    </Card>
  );
}

// Ports web's `.checkbox-row` (input[type=checkbox] + label) — used all
// over the event wizard (private-address toggle, promoter enable/guest-
// list/commission checks, allow-teams, etc). RN has no native checkbox.
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={() => onChange(!checked)}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxOn]}>
        {checked && <Check size={13} color={colors.onAccent} />}
      </View>
      {typeof label === 'string' ? <Txt style={styles.checkboxLabel}>{label}</Txt> : label}
    </Pressable>
  );
}

// Ports web's inline −/+ stepper (plus-ones, manual check-in guest count).
export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepperBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Text style={styles.stepperBtnLabel}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable style={styles.stepperBtn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Text style={styles.stepperBtnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.l,
    // A real lift, not just a border — every card read as flat paper
    // against the bg before this (organizer feedback 2026-09-18), ports
    // the wireframe reference's card/panel drop-shadow language.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  text: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.m,
    includeFontPadding: false,
  },
  muted: {
    color: colors.muted,
  },
  h1: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border3,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.l,
  },
  btn: {
    height: 50,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    // Matches the wireframe reference's accent-glow shadow on its primary
    // pill/button states, rather than a flat solid fill.
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnGhost: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border3,
  },
  btnDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  btnAccentOutline: {
    backgroundColor: 'rgba(155,225,61,0.1)',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.l,
    color: colors.text,
    includeFontPadding: false,
    textAlign: 'center',
  },
  btnLabelPrimary: {
    color: colors.onAccent,
  },
  btnLabelDanger: {
    color: colors.danger,
  },
  btnLabelAccentOutline: {
    color: colors.accent,
  },
  badge: {
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border3,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(31,138,91,0.16)',
    borderColor: colors.success,
  },
  badgeDanger: {
    backgroundColor: 'rgba(255,92,73,0.12)',
    borderColor: colors.danger,
  },
  badgeAccent: {
    backgroundColor: 'rgba(155,225,61,0.14)',
    borderColor: colors.accent,
  },
  badgeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.text,
    includeFontPadding: false,
  },
  badgeLabelAccent: {
    color: colors.accent,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s,
    padding: spacing.m,
    borderRadius: radius.m,
    backgroundColor: 'rgba(155,225,61,0.08)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  noticeWarning: {
    backgroundColor: 'rgba(245,192,74,0.1)',
    borderColor: colors.warning,
  },
  noticeError: {
    backgroundColor: 'rgba(255,92,73,0.08)',
    borderColor: colors.danger,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.s,
    lineHeight: 18,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border3,
    borderRadius: 999,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  chipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.s,
    color: colors.text,
    includeFontPadding: false,
    textAlign: 'center',
  },
  chipLabelOn: {
    color: colors.onAccent,
  },
  bar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flex: 1,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  kpi: {
    flex: 1,
    padding: spacing.m,
  },
  kpiLabel: {
    fontSize: 11.5,
    fontFamily: fontFamily.medium,
    includeFontPadding: false,
  },
  kpiValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    marginTop: 2,
    includeFontPadding: false,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.s,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.l,
    color: colors.text,
    includeFontPadding: false,
  },
  stepperValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.l,
    color: colors.text,
    minWidth: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.s,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: 'transparent',
    borderColor: colors.danger,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border3,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: fontSize.m,
    includeFontPadding: false,
  },
});
