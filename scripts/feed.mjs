// Pure helpers that turn Gumroad API products into storefront feed entries.
const SUMMARY_MAX = 180;

export const stripHtml = (html) => String(html || '')
  .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export const shortTitle = (name) => String(name || '')
  .split(' | ')[0]
  .split(': ')[0]
  .replace(/\s*\([^)]*\)\s*$/, '')
  .trim();

export function summaryOf(p) {
  const text = p.custom_summary?.trim() || stripHtml(p.description);
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export function classify(p) {
  const text = `${p.name} ${(p.tags || []).join(' ')}`;
  const kind = /barnaby|storybook|bedtime|coloring|kids|picture book/i.test(text) ? 'books' : 'tools';
  const m = /\bBook (\d+)\b/.exec(stripHtml(p.description));
  return m ? { kind, book: Number(m[1]) } : { kind };
}

export function productUrl(p, storeUrl) {
  const slug = p.custom_permalink || p.short_url?.split('/').pop();
  return storeUrl && slug ? `${storeUrl.replace(/\/$/, '')}/l/${slug}` : p.short_url;
}

export const isVisible = (p) => Boolean(p.published) && p.shown_on_profile !== false && !p.deleted;
