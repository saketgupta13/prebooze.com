import { getStateFromPath as defaultGetStateFromPath, type LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Every shareable web URL has two valid shapes — unprefixed (legacy/
// bookmarked, e.g. /events/slug) and city-scoped (e.g. /nagpur/events/slug,
// what Share buttons across the web app actually generate today). React
// Navigation's declarative `config.screens` can only match one fixed path
// per screen, so a leading city segment has to be stripped before the
// default parser ever sees the path — same job web's own CityScope/
// LegacyCityRedirect do for routing html. Without this, a shared link like
// prebooze.com/nagpur/u/someone would 404 inside the app instead of
// landing on that profile.
const ENTITY_PREFIXES = ['events', 'venues', 'organizers', 'promoter', 'lineup', 'u', 'browse', 'people', 'p', 'pass', 'r'];

function stripCityPrefix(path: string): string {
  const [, ...rest] = path.split('?')[0].split('/');
  if (rest.length === 0 || ENTITY_PREFIXES.includes(rest[0])) return path;
  if (rest.length > 1 && ENTITY_PREFIXES.includes(rest[1])) {
    const query = path.includes('?') ? `?${path.split('?')[1]}` : '';
    return '/' + rest.slice(1).join('/') + query;
  }
  return path;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://prebooze.com', 'prebooze-guest://'],
  config: {
    screens: {
      Main: { screens: { Home: '', People: 'people' } },
      EventDetail: 'events/:slug',
      OrganizerProfile: 'organizers/:id',
      VenueProfile: 'venues/:id',
      LineupProfile: 'lineup/:slug',
      PromoterProfile: 'promoter/:slug',
      PersonProfile: 'u/:username',
      Browse: 'browse',
      GuestListLanding: 'p/:eventSlug/:promoterSlug',
      GuestPass: 'pass/:passId',
      ReferralLanding: 'r/:code',
    },
  },
  getStateFromPath: (path, options) => defaultGetStateFromPath(stripCityPrefix(path), options),
};
