/** Persists in-progress onboarding form data to localStorage so navigating
 * away (e.g. the step-1 Back button) and returning doesn't lose it. Cleared
 * once the application is actually submitted. */
const key = (id: string) => `pb_draft_${id}`;

export function loadDraft<T extends object>(id: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveDraft(id: string, data: Record<string, unknown>) {
  localStorage.setItem(key(id), JSON.stringify(data));
}

export function clearDraft(id: string) {
  localStorage.removeItem(key(id));
}
