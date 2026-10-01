const KNOWN_TAG_RE = /<\/?(?:svg|text|tspan|rect|line|circle|g|path|polygon|polyline|ellipse|defs|style|image)\b[^<>]*\/?>/g;

/**
 * Escapes unescaped <, >, and & characters inside SVG text content
 * without altering actual SVG markup or double-escaping existing entities.
 */
export function escapeStraySvgText(svg: string): string {
  if (!svg) return svg;
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
