/** Plain-text preview of a WysiwygEditor field (description/about/bio) for
 * compact contexts — directory cards, one-line summaries — where rendering
 * the real HTML would show literal tags instead of formatted text. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
