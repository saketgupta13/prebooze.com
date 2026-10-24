/** Read-only CMS content endpoints — same contract as
 * prebooze-web/src/api/index.ts's `content` export. */
import { apiFetch } from './client';
import type { CmsBlogSummary, CmsFaq, CmsTestimonial } from '../types';

export const content = {
  banners: (city?: string) => apiFetch<CmsBanner[]>('/banners', { query: { city } }),
  testimonials: (featuredOnly?: boolean) => apiFetch<CmsTestimonial[]>('/testimonials', { query: { featured: featuredOnly } }),
  faqs: (audience?: 'guests' | 'organizers') => apiFetch<CmsFaq[]>('/faqs', { query: { audience } }),
  blogs: () => apiFetch<CmsBlogSummary[]>('/blogs'),
  reels: (city?: string) => apiFetch<CmsReel[]>('/reels', { query: { city } }),
  settings: () => apiFetch<PlatformInfo>('/settings'),
};

export interface CmsBanner {
  id: string;
  title: string;
  statusLabel: string;
  heading: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  imageUrl: string | null;
  active: boolean;
  sort: number;
}

export interface PlatformInfo {
  socials: { instagram?: string; facebook?: string; x?: string; youtube?: string; whatsapp?: string };
  footerCopyright?: string;
}

export interface CmsReel {
  id: string;
  title: string;
  hue: number;
  active: boolean;
  videoUrl: string | null;
  posterUrl: string | null;
  // Set only for a paid organizer/venue reel (2026-10-24) tied to a real
  // event — null for an ordinary admin-created reel. See
  // prebooze-web/src/api/index.ts's catalog.reels() own identical comment.
  bookUrl: string | null;
  createdAt: string;
}
