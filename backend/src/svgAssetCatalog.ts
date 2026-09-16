/**
 * The catalogue of visual themes a question can be drawn with.
 *
 * The database stores theme ids and nothing else. The artwork itself lives as
 * files under `frontend/public/assets/svg/questions/`, described by a
 * `manifest.json` alongside them. That split is deliberate: SVG markup already
 * sits inside Mongo in two other places (`questionBank.svgHtml` and
 * `levelHtmlTemplates.htmlContent`), and growing a third copy would mean the
 * same drawing could disagree with itself depending on which table you read.
 *
 * Ids are the contract. A theme may be re-drawn, or gain variants, without any
 * stored row changing.
 */

import fs from 'fs';
import path from 'path';

export interface SvgThemeVariant {
  variantId: string;
  file: string;
}

export interface SvgTheme {
  id: string;
  label: string;
  variants: SvgThemeVariant[];
  supportedAnswerShapes: string[];
  printSafe: boolean;
  viewBox: string;
}

interface Manifest {
  version: number;
  themes: SvgTheme[];
}

/**
 * Where the manifest lives. `WORKSHEET_ASSETS_DIR` already points the backend at
 * the frontend's public folder in production, so this follows the same route
 * rather than inventing a second convention.
 */
function manifestPath(): string {
  const assetsDir = process.env.WORKSHEET_ASSETS_DIR
    || path.resolve(__dirname, '../../frontend/public/worksheets');
  return path.resolve(assetsDir, '../assets/svg/questions/manifest.json');
}

let cached: Manifest | null = null;

/**
 * Read the manifest once per process.
 *
 * A missing or unreadable manifest returns an empty catalogue rather than
 * throwing. The authoring API must still answer when the asset folder has not
 * been deployed; it will simply reject every theme id, which is a legible
 * failure rather than a crashed route.
 */
export function loadManifest(): Manifest {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(manifestPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Manifest;
    cached = Array.isArray(parsed?.themes) ? parsed : { version: 0, themes: [] };
  } catch {
    console.warn('[svgAssetCatalog] no readable manifest at', manifestPath());
    cached = { version: 0, themes: [] };
  }
  return cached;
}

export function listThemes(): SvgTheme[] {
  return loadManifest().themes;
}

export function isKnownThemeId(id: string): boolean {
  return listThemes().some(t => t.id === id);
}

/**
 * Pick a variant deterministically from a seed (a student id, a paper id).
 *
 * Deterministic rather than random so that regenerating a paper produces the
 * same artwork: a child who is re-issued their sheet should not receive a
 * visually different one, and a mismatch would confuse ICR scanning.
 */
export function pickVariant(themeId: string, seed: string): SvgThemeVariant | undefined {
  const theme = listThemes().find(t => t.id === themeId);
  if (!theme || theme.variants.length === 0) return undefined;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return theme.variants[hash % theme.variants.length];
}

/**
 * Reject anything that is not a plain, self-contained drawing.
 *
 * Applied at import time, never at render time. An SVG is executable markup:
 * a script tag or an external reference inside one would run in the browser of
 * whoever opened the worksheet, so the safe move is to refuse it on the way in.
 */
export function validateSvgMarkup(svg: string): string | null {
  if (!/^\s*<svg[\s>]/i.test(svg)) return 'Not an SVG document.';
  if (!/viewBox\s*=/.test(svg)) return 'SVG must declare a viewBox so it scales on a printed page.';
  if (/<script/i.test(svg)) return 'SVG must not contain a script.';
  if (/\son\w+\s*=/i.test(svg)) return 'SVG must not contain event handler attributes.';
  if (/(href|xlink:href|src)\s*=\s*["']?\s*(https?:)?\/\//i.test(svg)) return 'SVG must not reference an external URL.';
  if (/<foreignObject/i.test(svg)) return 'SVG must not contain a foreignObject.';
  if (svg.length > 200_000) return 'SVG is too large.';
  return null;
}
