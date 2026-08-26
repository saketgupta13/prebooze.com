/** Single source of truth for what "finish your profile" means — used by
 * AuthService.claimProfileCompletionReward (the actual reward grant) and by
 * BookingsService's post-booking nudge (whether it's even worth asking). */
export interface ProfileFields {
  avatarUrl: string | null;
  username: string;
  city: string;
  state: string | null;
  country: string | null;
  profession: string;
  languages: string;
  bio: string;
  socialLinks: unknown;
  interests: string[];
}

export function missingProfileFields(user: ProfileFields): string[] {
  const missing: string[] = [];
  if (!user.avatarUrl) missing.push('profile photo');
  if (!user.username.trim()) missing.push('username');
  if (!user.city.trim()) missing.push('city');
  if (!user.state?.trim()) missing.push('state');
  if (!user.country?.trim()) missing.push('country');
  if (!user.profession.trim()) missing.push('profession');
  if (!user.languages.trim()) missing.push('languages');
  if (!user.bio.trim()) missing.push('bio');
  if (!Object.values((user.socialLinks as Record<string, string>) ?? {}).some((v) => v?.trim())) missing.push('a social link');
  if (user.interests.length === 0) missing.push('an interest');
  return missing;
}
