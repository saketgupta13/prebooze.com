import type { Event } from '../types';
import type { PlatformInfo } from '../api';

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
    description: event.description,
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
