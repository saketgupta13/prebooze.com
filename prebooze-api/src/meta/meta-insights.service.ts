import { Injectable, Logger } from '@nestjs/common';

export interface CampaignInsights {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
}

/** Real ad performance from Meta's own Marketing API — the same System User
 * token already used for the Conversions API (confirmed to also carry
 * ads_read on act_846431631873167, the one shared ad account every
 * organizer/venue's campaign runs under). On-demand only, never
 * cached/persisted or auto-synced — a staff/organizer click fetches the
 * current real numbers straight from Meta each time, so there's no stale
 * snapshot to keep in sync and no new schema/migration needed. Always
 * scoped to specific campaign ids (never an account-wide query), which is
 * what keeps one organizer/venue's real ad data from ever surfacing
 * another's. */
@Injectable()
export class MetaInsightsService {
  private readonly log = new Logger('MetaInsights');

  get live(): boolean {
    return Boolean(process.env.META_ACCESS_TOKEN);
  }

  /** Real spend/impressions/reach/clicks for one Meta campaign id. Returns
   * null on any failure (invalid/deleted campaign id, permission issue,
   * rate limit) rather than throwing — this is always a nice-to-have
   * overlay on top of the platform's own real on-site funnel data, never
   * something that should break the page it's shown on. */
  // datePreset is left unset by every existing caller — Graph API then
  // defaults to the last 7 days, which is what the on-demand "check
  // performance" button has always shown. 'maximum' (added 2026-10-04,
  // used only by adminAdSpendSummary) asks for the real lifetime total
  // instead — the number that actually matters against a lifetime ad set
  // budget, where a 7-day window would understate what's really been spent.
  async getCampaignInsights(campaignId: string, datePreset?: string): Promise<CampaignInsights | null> {
    if (!this.live || !campaignId.trim()) return null;
    try {
      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(campaignId.trim())}/insights?fields=spend,impressions,reach,clicks,ctr${datePreset ? `&date_preset=${datePreset}` : ''}&access_token=${process.env.META_ACCESS_TOKEN}`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok || body.error) {
        this.log.warn(`Insights fetch failed for campaign ${campaignId}: ${body?.error?.message ?? res.status}`);
        return null;
      }
      const row = body.data?.[0];
      if (!row) return { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0 };
      return {
        spend: Math.round(parseFloat(row.spend ?? '0')),
        impressions: parseInt(row.impressions ?? '0', 10),
        reach: parseInt(row.reach ?? '0', 10),
        clicks: parseInt(row.clicks ?? '0', 10),
        ctr: parseFloat(row.ctr ?? '0'),
      };
    } catch (e) {
      this.log.warn(`Insights fetch threw for campaign ${campaignId}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  /** A 30-day-plan order can have more than one Meta campaign id behind it
   * (one per event covered, or however staff structured the real campaigns)
   * — stored as a comma-separated list in the same metaCampaignId field a
   * per-event order stores a single id in (see MarketingOrder's own doc
   * comment). Sums the real, individually-fetched numbers rather than
   * querying Meta for a combined figure — ctr is recomputed from the
   * summed clicks/impressions instead of averaging the per-campaign ctr
   * values, which would be wrong once campaigns have different volumes. */
  async getCombinedInsights(campaignIdsCsv: string, datePreset?: string): Promise<CampaignInsights | null> {
    const ids = campaignIdsCsv.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return null;
    const results = await Promise.all(ids.map((id) => this.getCampaignInsights(id, datePreset)));
    const found = results.filter((r): r is CampaignInsights => r !== null);
    if (found.length === 0) return null;
    const spend = found.reduce((a, r) => a + r.spend, 0);
    const impressions = found.reduce((a, r) => a + r.impressions, 0);
    const reach = found.reduce((a, r) => a + r.reach, 0);
    const clicks = found.reduce((a, r) => a + r.clicks, 0);
    return { spend, impressions, reach, clicks, ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0 };
  }
}
