import type { Event, Venue, Organizer, PromoterProfile, LineupProfile } from '../types';
import type { PlatformInfo } from '../api';
import { stripHtml } from './richtext';

const SITE_ORIGIN = 'https://prebooze.com';

/** Schema.org Event — what unlocks Google's dedicated event rich results
 * (event cards/carousels in search, sometimes a full "Things to do"
 * panel), which a ticketing site otherwise gets none of no matter how
 * good the on-page SEO copy is. Field choices follow Google's documented
 * required/recommended properties for the Event rich result specifically,
 * not just a generic schema.org dump. */
export function buildEventSchema(event: Event) {
  const venue = event.venue;
  const start = new Date(event.date);
  const end = new Date(start.getTime() + event.durationHrs * 60 * 60 * 1000);
  const url = `${SITE_ORIGIN}/events/${event.slug}`;

  const location = venue
    ? {
        '@type': 'Place',
        name: venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: venue.address,
          addressLocality: venue.city,
          addressRegion: venue.state || undefined,
          postalCode: venue.pincode || undefined,
          addressCountry: venue.country || 'IN',
        },
      }
    : event.privateCity
      ? {
          '@type': 'Place',
          name: event.privateLocality || 'Private location',
          address: {
            '@type': 'PostalAddress',
            addressLocality: event.privateCity,
            addressCountry: 'IN',
          },
        }
      : undefined;

  const offers = event.tiers.map((t) => ({
    '@type': 'Offer',
    name: t.name,
    url,
    price: t.price,
    priceCurrency: 'INR',
    availability: t.sold >= t.quantity ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: stripHtml(event.description),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    image: event.posterUrl ? [event.posterUrl] : undefined,
    location,
    offers: offers.length ? offers : undefined,
    organizer: event.organizer
      ? { '@type': 'Organization', name: event.organizer.brandName, url: `${SITE_ORIGIN}/organizers/${event.organizer.id}` }
      : undefined,
  };
}

/** Site-wide Organization schema — feeds Google's Knowledge Panel data
 * and ties search results back to a real brand entity rather than just a
 * URL. Built from live platform settings (not hardcoded) so it never
 * drifts from whatever admin has actually configured in Settings. */
export function buildOrganizationSchema(info: PlatformInfo) {
  const sameAs = Object.values(info.socials).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Prebooze',
    url: SITE_ORIGIN,
    logo: info.logoUrl || `${SITE_ORIGIN}/prebooze-logo.png`,
    ...(sameAs.length ? { sameAs } : {}),
    contactPoint: {
      '@type': 'ContactPoint',
      email: info.contact.email,
      telephone: info.contact.phone,
      contactType: 'customer service',
    },
  };
}

type SocialLinks = { instagram?: string; facebook?: string; other?: string[] } | undefined;

function socialLinksToSameAs(links: SocialLinks): string[] {
  if (!links) return [];
  return [links.instagram, links.facebook, ...(links.other ?? [])].filter((l): l is string => !!l);
}

function urlListToSameAs(links: string[] | undefined): string[] {
  return (links ?? []).map((l) => (l.startsWith('http') ? l : `https://${l}`));
}

/** Venue profile — LocalBusiness, so a venue with real reviews/ratings
 * becomes eligible for the star-rating rich result in search, and its
 * address can surface in a map/local pack. */
export function buildVenueSchema(venue: Venue) {
  const sameAs = socialLinksToSameAs(venue.socialLinks);
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: venue.name,
    description: stripHtml(venue.about),
    url: `${SITE_ORIGIN}/venues/${venue.id}`,
    image: venue.logoUrl || venue.galleryUrls?.[0] || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.city,
      addressRegion: venue.state || undefined,
      postalCode: venue.pincode || undefined,
      addressCountry: venue.country || 'IN',
    },
    aggregateRating: venue.rating && venue.reviewCount
      ? { '@type': 'AggregateRating', ratingValue: venue.rating, reviewCount: venue.reviewCount }
      : undefined,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Organizer profile — Organization, mirrors the site-wide schema but
 * scoped to this one brand, with its own real rating from event reviews. */
export function buildOrganizerSchema(organizer: Organizer) {
  const sameAs = socialLinksToSameAs(organizer.socialLinks);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: organizer.brandName,
    description: stripHtml(organizer.about),
    url: `${SITE_ORIGIN}/organizers/${organizer.id}`,
    logo: organizer.logoUrl || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: organizer.city,
      addressRegion: organizer.state || undefined,
      postalCode: organizer.pincode || undefined,
      addressCountry: organizer.country || 'IN',
    },
    aggregateRating: organizer.rating && organizer.reviewCount
      ? { '@type': 'AggregateRating', ratingValue: organizer.rating, reviewCount: organizer.reviewCount }
      : undefined,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Promoter profile — Organization (a guest-list/affiliate promotion
 * business), same pattern as Organizer minus the fields promoters don't
 * have (no address, no numeric rating — showRate isn't a review score). */
export function buildPromoterSchema(promoter: PromoterProfile) {
  const sameAs = urlListToSameAs(promoter.links);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: promoter.name,
    description: stripHtml(promoter.bio),
    url: `${SITE_ORIGIN}/promoter/${promoter.slug}`,
    logo: promoter.logoUrl || undefined,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Line-up profile — PerformingGroup, the schema.org type for bands, DJs
 * and artist acts (covers both solo performers billed as an act and
 * groups, which is how Lineup.category is actually used — Band/DJ/Artist
 * etc — rather than guessing per-category between Person and
 * PerformingGroup). */
export function buildLineupSchema(lineup: LineupProfile) {
  const sameAs = urlListToSameAs(lineup.links);
  return {
    '@context': 'https://schema.org',
    '@type': 'PerformingGroup',
    name: lineup.name,
    description: stripHtml(lineup.bio),
    url: `${SITE_ORIGIN}/lineup/${lineup.slug}`,
    image: lineup.logoUrl || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: lineup.city,
      addressRegion: lineup.state || undefined,
      postalCode: lineup.pincode || undefined,
      addressCountry: lineup.country || 'IN',
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList — lets Google show a real navigational path (Home >
 * Venues > Nine O Nine) under a search result instead of the raw URL. */
export function buildBreadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_ORIGIN}${c.path}`,
    })),
  };
}
