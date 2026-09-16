/** Ported verbatim from prebooze-web/src/lib/promoterPass.ts — same
 * IST-anchored cutoff math (India-only, no DST), needed by Scanner to know
 * whether a promoter free-entry pass is still inside its "free before
 * HH:MM" window. */
import type { Event } from '../types';

const IST_OFFSET_MIN = 5.5 * 60;

export function cutoffDate(event: Event): Date | null {
  const cfg = event.promoterConfig;
  if (!cfg?.enabled || !cfg.cutoff) return null;
  const startIstMs = new Date(event.date).getTime() + IST_OFFSET_MIN * 60000;
  const startIst = new Date(startIstMs);
  const [h, m] = cfg.cutoff.split(':').map(Number);
  const cIst = new Date(Date.UTC(startIst.getUTCFullYear(), startIst.getUTCMonth(), startIst.getUTCDate(), h, m, 0, 0));
  if (cIst.getTime() < startIst.getTime()) cIst.setUTCDate(cIst.getUTCDate() + 1);
  return new Date(cIst.getTime() - IST_OFFSET_MIN * 60000);
}

export function isPassValid(event: Event): boolean {
  const c = cutoffDate(event);
  return c ? Date.now() < c.getTime() : false;
}

export function countdownLabel(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const mm = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}
