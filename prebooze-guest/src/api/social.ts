/** Follow system + guest privacy settings — same contract as
 * prebooze-web/src/api/index.ts's `social` export. */
import { apiFetch } from './client';
import type { GuestReview, Person } from '../types';

export const social = {
  follow: (key: string) => apiFetch<void>('/follows', { body: { key } }),
  unfollow: (key: string) => apiFetch<void>('/follows', { method: 'DELETE', body: { key } }),
  mySocialState: () => apiFetch<{ following: string[]; interested: string[]; wishlist: string[]; favouriteVenues: string[] }>('/me/social'),
  followers: () => apiFetch<Person[]>('/me/followers'),
  setAttendanceVisibility: (v: 'off' | 'followers' | 'public') => apiFetch<void>('/me/attendance-visibility', { body: { v } }),
  setDiscoverable: (on: boolean) => apiFetch<void>('/me/discoverable', { body: { on } }),
  setMarketingConsent: (on: boolean) => apiFetch<void>('/me/marketing-consent', { body: { on } }),
  interested: (eventId: string, on: boolean) => apiFetch<void>(`/events/${eventId}/interested`, { body: { on } }),
  wishlist: (eventId: string, on: boolean) => apiFetch<void>(`/events/${eventId}/wishlist`, { body: { on } }),
  favVenue: (venueId: string, on: boolean) => apiFetch<void>(`/venues/${venueId}/favourite`, { body: { on } }),
  organizerReviews: (orgId: string) => apiFetch<GuestReview[]>(`/organizers/${orgId}/reviews`),
  notifications: () => apiFetch<GuestNotification[]>('/me/notifications'),
  unreadNotificationCount: () => apiFetch<{ count: number }>('/me/notifications/unread-count'),
  markNotificationRead: (id: string) => apiFetch<void>(`/me/notifications/${id}/read`, { body: {} }),
  markAllNotificationsRead: () => apiFetch<void>('/me/notifications/read-all', { body: {} }),
};

export interface GuestNotification {
  id: string;
  icon: string;
  text: string;
  to?: string | null;
  read: boolean;
  createdAt: string;
}

export const socialReviews = {
  organizer: (id: string) => apiFetch<OrgReview[]>(`/organizers/${id}/reviews`),
  addOrganizerReview: (id: string, rating: number, text: string, eventId?: string) =>
    apiFetch<OrgReview>(`/organizers/${id}/reviews`, { body: { rating, text, eventId } }),
  venue: (id: string) => apiFetch<VenueReview[]>(`/venues/${id}/reviews`),
  addVenueReview: (id: string, rating: number, text: string) =>
    apiFetch<VenueReview>(`/venues/${id}/reviews`, { body: { rating, text } }),
};

export interface OrgReview { id: string; author: string; rating: number; text: string; date: string; eventTitle?: string }
export interface VenueReview { id: string; author: string; rating: number; text: string; date: string }
