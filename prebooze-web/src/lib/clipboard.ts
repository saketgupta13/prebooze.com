/** Real success/failure, not fire-and-forget. navigator.clipboard is only
 * available in a secure context and can be entirely absent in older/in-app
 * WebViews (e.g. some Instagram/WhatsApp in-app browsers) — those callers
 * used to get a silent no-op with a `.catch(() => {})` that swallowed the
 * failure and then showed "Copied ✓" anyway regardless of whether anything
 * actually landed on the clipboard. This tries the modern API first, falls
 * back to the legacy execCommand('copy') path (works in far more WebViews),
 * and only ever reports true when a copy method actually ran without error. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy method below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
