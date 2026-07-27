/** Forces a real download for cross-origin files (KYC docs served from
 * api.prebooze.com, viewed on admin.prebooze.com). A plain `<a href download>`
 * silently ignores the `download` attribute for cross-origin URLs — the
 * browser just navigates to/opens the file instead. Fetching it and
 * triggering the save from a same-origin blob URL works everywhere. */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
