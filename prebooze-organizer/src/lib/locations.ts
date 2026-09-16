// Faithful port of prebooze-web/src/data/locations.ts — static
// country/state/city fallback data for LocationPicker, used when the real
// GET /cities call (state-linked, admin-managed) doesn't cover a state yet.
export interface Country {
  name: string;
  iso: string;
  dial: string;
  flag: string;
  enabled: boolean;
}

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

export const enabledCountries = COUNTRIES.filter((c) => c.enabled);

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

export const CITIES: Record<string, string[]> = {
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
  California: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose'],
  Florida: ['Miami', 'Orlando', 'Tampa'],
  Illinois: ['Chicago', 'Springfield'],
  'New York': ['New York City', 'Buffalo', 'Rochester'],
  Texas: ['Austin', 'Dallas', 'Houston', 'San Antonio'],
  Washington: ['Seattle', 'Spokane', 'Tacoma'],
  England: ['London', 'Manchester', 'Birmingham', 'Leeds'],
  Scotland: ['Edinburgh', 'Glasgow'],
  Wales: ['Cardiff', 'Swansea'],
  Dubai: ['Dubai'],
  'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
  Sharjah: ['Sharjah'],
};

export const statesFor = (country: string) => STATES[country] ?? [];
export const citiesFor = (state: string) => CITIES[state] ?? [];
