import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { listThemes, pickVariant, validateSvgMarkup } from '../src/svgAssetCatalog';

// Use this checkout's actual catalog, without booting or writing to a database.
const publicDir = fileURLToPath(new URL('../../frontend/public/', import.meta.url));
process.env.WORKSHEET_ASSETS_DIR = path.join(publicDir, 'worksheets');
const assetDir = path.join(publicDir, 'assets/svg/questions');
const originalVariants: Record<string, string[]> = {
  fruits: ['apple', 'pear'], vegetables: ['carrot', 'pepper'],
  animals: ['cat', 'bird'], pets: ['dog', 'fish'], vehicles: ['car', 'bus'],
  'street-furniture': ['streetlight', 'sign'], buildings: ['house', 'school'],
  clothing: ['shirt', 'shoe'], 'flowers-trees': ['flower', 'tree'],
  'classroom-objects': ['pencil', 'book'], mixed: ['circle', 'square'],
};

async function selectedDrawings() {
  const drawings: { themeId: string; variantId: string; seed: string; svg: string }[] = [];
  for (const theme of listThemes()) {
    for (const variant of theme.variants) {
      // Find a student/paper seed that exercises each entry through the real selector.
      let seed: string | undefined;
      for (let paper = 0; paper < 1000; paper++) {
        const candidate = `test-student:test-paper-${paper}`;
        if (pickVariant(theme.id, candidate)?.variantId === variant.variantId) {
          seed = candidate;
          break;
        }
      }
      assert.ok(seed, `Variant is unreachable: ${theme.id}/${variant.variantId}`);
      const selected = pickVariant(theme.id, seed)!;
      assert.deepEqual(pickVariant(theme.id, seed), selected);
      drawings.push({ themeId: theme.id, variantId: selected.variantId, seed,
        svg: await readFile(path.join(assetDir, selected.file), 'utf8') });
    }
  }
  return drawings;
}

test('catalog has 50 registered objects, preserves existing IDs, and references safe SVG files', async () => {
  const themes = listThemes();
  assert.deepEqual(themes.map(theme => theme.id), Object.keys(originalVariants));
  const files = new Set<string>();
  for (const theme of themes) {
    assert.ok(theme.label);
    assert.equal(theme.printSafe, true);
    assert.equal(theme.viewBox, '0 0 64 64');
    assert.deepEqual(theme.supportedAnswerShapes, ['single-number', 'fill-blanks', 'mcq-4']);
    assert.deepEqual(theme.variants.slice(0, 2).map(v => v.variantId), originalVariants[theme.id]);
    assert.equal(new Set(theme.variants.map(v => v.variantId)).size, theme.variants.length);
    for (const variant of theme.variants) {
      assert.match(variant.variantId, /^[a-z][a-z-]*$/);
      assert.equal(variant.file, `${theme.id}--${variant.variantId}.svg`);
      assert.ok(!files.has(variant.file));
      files.add(variant.file);
      const svg = await readFile(path.join(assetDir, variant.file), 'utf8');
      assert.equal(validateSvgMarkup(svg), null, variant.file);
      assert.match(svg, /viewBox="0 0 64 64"/);
      assert.doesNotMatch(svg, /<(?:image|use|style|filter|linearGradient|radialGradient)\b|\b(?:href|src)=/i);
    }
  }
  assert.equal(files.size, 50);
  assert.deepEqual((await readdir(assetDir)).filter(file => file.endsWith('.svg')).sort(), [...files].sort());
});

test('same student/paper seeds reproduce every variant within the updated catalog', async () => {
  const originalPaper = await selectedDrawings();
  const reissuedPaper = await selectedDrawings();
  assert.equal(originalPaper.length, 50);
  assert.deepEqual(reissuedPaper, originalPaper);
  assert.equal(pickVariant('nonexistent-theme', 'test-student:test-paper'), undefined);
});

test('browser renders every selected SVG without clipping and prints a test worksheet', {
  skip: process.env.RUN_BROWSER_TESTS !== '1',
}, async () => {
  const { default: puppeteer } = await import('puppeteer');
  const { PDFDocument } = await import('pdf-lib');
  const drawings = await selectedDrawings();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'fln-svg-review-'));
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setViewport({ width: 1000, height: 900 });
    await page.setContent('<html><body></body></html>');
    const results = await page.evaluate(async entries => {
      const results = [];
      for (const entry of entries) {
        const parsed = new DOMParser().parseFromString(entry.svg, 'image/svg+xml');
        if (parsed.querySelector('parsererror')) throw new Error(`Invalid XML: ${entry.variantId}`);
        const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
        document.body.append(svg);
        const box = svg.getBBox();
        const strokes = Array.from(svg.querySelectorAll('path, circle, ellipse, rect, polygon, line, polyline'))
          .map(element => Number.parseFloat(getComputedStyle(element).strokeWidth));
        const padding = Math.max(...strokes) / 2;
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(entry.svg)}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 64, 64);
        ctx.drawImage(image, 0, 0, 64, 64);
        const pixels = ctx.getImageData(0, 0, 64, 64).data;
        let ink = 0;
        let grayscale = true;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] < 200) ink++;
          if (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2]) grayscale = false;
        }
        results.push({ id: `${entry.themeId}/${entry.variantId}`, ink, grayscale,
          left: box.x - padding, top: box.y - padding,
          right: box.x + box.width + padding, bottom: box.y + box.height + padding });
        svg.remove();
      }
      return results;
    }, drawings);
    for (const result of results) {
      assert.ok(result.ink > 50, `Blank drawing: ${result.id}`);
      assert.ok(result.grayscale, `Non-monochrome drawing: ${result.id}`);
      assert.ok(result.left >= 0 && result.top >= 0 && result.right <= 64 && result.bottom <= 64,
        `Clipped drawing: ${JSON.stringify(result)}`);
    }

    const contactSheet = `<html><head><style>body{font:14px Arial;background:white;color:#111}
      main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
      figure{margin:0;padding:16px;text-align:center;border:1px solid #ddd}
      svg{width:96px;height:96px}figcaption{margin-top:8px}</style></head><body>
      <h1>SVG object library — 50 objects</h1><main>${drawings.map(d =>
      `<figure>${d.svg}<figcaption>${d.themeId}<br>${d.variantId}</figcaption></figure>`).join('')}</main></body></html>`;
    await page.setContent(contactSheet);
    await page.screenshot({ path: path.join(outputDir, 'catalog.png'), fullPage: true });
    const pages: string[] = [];
    for (let start = 0; start < drawings.length; start += 4) {
      pages.push(`<section><h1>Count the objects</h1>${drawings.slice(start, start + 4).map((d, index) =>
        `<article><p>${start + index + 1}. How many objects?</p>${d.svg.repeat(3)}<p>Answer: ______</p></article>`).join('')}</section>`);
    }
    const worksheet = `<html><head><style>@page{size:A4;margin:15mm}
      body{font:16px Arial;color:#111}section{break-after:page}section:last-child{break-after:auto}
      h1{font-size:22px}article{height:52mm;break-inside:avoid}svg{width:22mm;height:22mm;margin-right:8mm}
      </style></head><body>${pages.join('')}</body></html>`;
    await page.setContent(worksheet);
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), Math.ceil(drawings.length / 4));
    assert.deepEqual(errors, []);
    await writeFile(path.join(outputDir, 'worksheet.pdf'), pdf);
    await writeFile(path.join(outputDir, 'worksheet.html'), worksheet);
    if (process.env.KEEP_SVG_REVIEW === '1') console.log(`SVG review artifacts: ${outputDir}`);
  } finally {
    await browser.close();
    if (process.env.KEEP_SVG_REVIEW !== '1') await rm(outputDir, { recursive: true, force: true });
  }
});
