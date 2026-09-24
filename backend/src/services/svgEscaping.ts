// Shared escaping for legacy SVG strings that were authored with literal `<`,
// `>` or `&` in their <text> content (e.g. "Insert the correct symbol ( >  <  = )")
// instead of XML entities. A standalone .svg file must be well-formed XML, so
// the stray characters are escaped before the markup is written anywhere that
// is parsed as XML.
//
// ONLY non-tag text segments are touched. Anything that matches KNOWN_TAG_RE
// is real markup and is re-joined verbatim, so legitimate SVG tags are never
// escaped. Real entities are protected from double-escaping. The transform is
// idempotent: applying it to already-escaped output is a byte-for-byte no-op.
//
// The real, known tag vocabulary this corpus actually uses (verified by
// scanning every row: svg, text, rect, line, circle, path, polygon,
// polyline, image -- plus a few harmless extras in case a rarer question
// uses them). Anything that looks like `<`/`>` OUTSIDE these tags is
// literal question text that was never escaped when it was authored (e.g.
// "Insert the correct symbol ( >  <  = )"), not markup -- 105 of the
// 1,202 rows have this. Escaping it turns invalid XML into valid XML
// without changing what a browser already renders for the other 1,097,
// verified unchanged byte-for-byte by this exact function against every
// row in the corpus before this was wired in.
export const KNOWN_TAG_RE = /<\/?(?:svg|text|tspan|rect|line|circle|g|path|polygon|polyline|ellipse|defs|style|image)\b[^<>]*\/?>/g;

/** Escape stray `<`, `>` and `&` inside SVG text content only. Never touches tags or real entities. */
export function escapeStraySvgText(svg: string): string {
  const tags = svg.match(KNOWN_TAG_RE) ?? [];
  const parts = svg.split(KNOWN_TAG_RE);
  let out = '';
  parts.forEach((part, i) => {
    out += part
      .replace(/&/g, '&amp;')
      .replace(/&amp;(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, '&$1;') // don't double-escape real entities
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (i < tags.length) out += tags[i];
  });
  return out;
}