// Event.description (and other WysiwygEditor-backed fields — organizer/
// venue "about" bios) store real HTML from web's contentEditable rich-text
// editor (prebooze-web/src/components/WysiwygEditor.tsx) — bold/italic/
// lists/headings/links, not just paragraphs. RN has no equivalent rich
// editor, so this app treats these fields as plain text on both ends:
// strip tags to real line breaks for display/editing here, and whatever
// gets typed back in RN saves as plain text (losing any rich formatting
// that existed, same tradeoff any plain-text editor accepts touching a
// rich field — but the literal HTML never shows as visible garbage again).
//
// Real bug found live (2026-09-21): a description saved via web's editor
// showed up in this app as literal "...together.</div>" — nothing here
// stripped the tags before display or before loading into the edit field.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The inverse, used when *saving* a description edited in this app —
// without it, plain text with bare `\n` line breaks sent back to the
// server would render as one run-on paragraph on web (HTML ignores bare
// newlines), silently flattening whatever paragraph structure the
// organizer typed here. Matches WysiwygEditor's own div-per-line shape
// (an empty line between paragraphs becomes `<div><br></div>`) closely
// enough that re-opening this same description in web's rich editor still
// shows real paragraph breaks — just plain text, no bold/lists/links,
// since RN never captures those in the first place.
export function plainTextToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : '<div><br></div>'))
    .join('');
}
