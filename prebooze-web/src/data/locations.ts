export interface Country {
  name: string;
  iso: string;
  dial: string;
  flag: string;
  enabled: boolean; // available as an onboarding location (drives the login code list)
}

/** Countries — `enabled` ones are the supported locations (India first / default).
 * Only enabled countries appear as dial codes at login and in the location picker. */
export const COUNTRIES: Country[] = [
  { name: 'India', iso: 'IN', dial: '+91', flag: '🇮🇳', enabled: true },
  { name: 'United States', iso: 'US', dial: '+1', flag: '🇺🇸', enabled: false },
  { name: 'United Kingdom', iso: 'GB', dial: '+44', flag: '🇬🇧', enabled: false },
  { name: 'United Arab Emirates', iso: 'AE', dial: '+971', flag: '🇦🇪', enabled: true },
  { name: 'Canada', iso: 'CA', dial: '+1', flag: '🇨🇦', enabled: false },
  { name: 'Australia', iso: 'AU', dial: '+61', flag: '🇦🇺', enabled: false },
  { name: 'Singapore', iso: 'SG', dial: '+65', flag: '🇸🇬', enabled: false },
  { name: 'Germany', iso: 'DE', dial: '+49', flag: '🇩🇪', enabled: false },
  { name: 'France', iso: 'FR', dial: '+33', flag: '🇫🇷', enabled: false },
  { name: 'Netherlands', iso: 'NL', dial: '+31', flag: '🇳🇱', enabled: false },
  { name: 'Spain', iso: 'ES', dial: '+34', flag: '🇪🇸', enabled: false },
  { name: 'Italy', iso: 'IT', dial: '+39', flag: '🇮🇹', enabled: false },
  { name: 'Nepal', iso: 'NP', dial: '+977', flag: '🇳🇵', enabled: false },
  { name: 'Sri Lanka', iso: 'LK', dial: '+94', flag: '🇱🇰', enabled: false },
  { name: 'Bangladesh', iso: 'BD', dial: '+880', flag: '🇧🇩', enabled: false },
  { name: 'Malaysia', iso: 'MY', dial: '+60', flag: '🇲🇾', enabled: false },
  { name: 'Thailand', iso: 'TH', dial: '+66', flag: '🇹🇭', enabled: false },
  { name: 'Japan', iso: 'JP', dial: '+81', flag: '🇯🇵', enabled: false },
  { name: 'Saudi Arabia', iso: 'SA', dial: '+966', flag: '🇸🇦', enabled: false },
  { name: 'Qatar', iso: 'QA', dial: '+974', flag: '🇶🇦', enabled: false },
];

/** Enabled countries only — for the login code dropdown and location picker. */
export const enabledCountries = COUNTRIES.filter((c) => c.enabled);

/** country name -> states (only populated where we cascade cities). */
export const STATES: Record<string, string[]> = {
  India: [
    'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab',
    'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  ],
  'United States': ['California', 'Florida', 'Illinois', 'New York', 'Texas', 'Washington'],
  'United Kingdom': ['England', 'Scotland', 'Wales'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
};

/** state -> cities. */
export const CITIES: Record<string, string[]> = {
  // India
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
  Assam: ['Guwahati', 'Silchar', 'Dibrugarh'],
  Bihar: ['Patna', 'Gaya', 'Bhagalpur'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Saket'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli', 'Belagavi'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  Punjab: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur', 'Varanasi', 'Agra'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'],
  // United States
  California: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose'],
  Florida: ['Miami', 'Orlando', 'Tampa'],
  Illinois: ['Chicago', 'Springfield'],
  'New York': ['New York City', 'Buffalo', 'Rochester'],
  Texas: ['Austin', 'Dallas', 'Houston', 'San Antonio'],
  Washington: ['Seattle', 'Spokane', 'Tacoma'],
  // UK
  England: ['London', 'Manchester', 'Birmingham', 'Leeds'],
  Scotland: ['Edinburgh', 'Glasgow'],
  Wales: ['Cardiff', 'Swansea'],
  // UAE
  Dubai: ['Dubai'],
  'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
  Sharjah: ['Sharjah'],
};

export const statesFor = (country: string) => STATES[country] ?? [];
export const citiesFor = (state: string) => CITIES[state] ?? [];

/** Every city under an enabled country — mirrors the admin Locations config and
 * feeds the city-picker's searchable list. */
export const enabledLocationCities = (): string[] =>
  Array.from(
    new Set(enabledCountries.flatMap((c) => statesFor(c.name).flatMap((s) => citiesFor(s))))
  ).sort();
