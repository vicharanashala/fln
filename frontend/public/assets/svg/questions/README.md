# Reusable question objects

This catalog contains 50 standalone objects across 11 themes. The 28 additions
for issue #589 are original SVG path drawings, not copies of the legacy
full-question renders. Existing theme IDs, variant IDs, and artwork are retained.

## Adding an object

- Use `<theme-id>--<variant-id>.svg` and append its entry to that theme in
  `manifest.json`.
- Keep a `0 0 64 64` viewBox, monochrome outlines, and enough inset to avoid
  clipping strokes. Avoid fonts, scripts, external references, and embedded images.
- Use a recognizable, age-appropriate object that remains legible when printed
  at worksheet size. `printSafe: true` describes the entire theme.
- Keep existing IDs stable. The database references theme IDs; the files live here.

## Verification

Run from the repository root:

```sh
node --import tsx --test backend/tests/svg-asset-catalog.test.ts
npm run lint
npm run build
```

For the optional browser test, set `RUN_BROWSER_TESTS=1` and, if needed,
`CHROME_EXECUTABLE_PATH` to a local Chromium browser, then run the test command
again. Set `KEEP_SVG_REVIEW=1` to retain the contact sheet PNG and printable
worksheet HTML/PDF in the temporary directory printed by the test.

The browser test reaches every variant through the existing backend
`pickVariant(themeId, studentAndPaperSeed)` function, checks XML, bounds and
monochrome raster output, and prints the selected artwork in a test worksheet.
This is an asset-library check, not a claim that the production authoring-to-paper
pipeline is wired; that separate work is tracked in #486.

Selection repeats for the same seed **with the same catalog**. The current
selector hashes modulo the number of variants, so adding/reordering variants can
change the artwork for an older seed. This expansion does not change that
algorithm or guarantee identical artwork across catalog versions. Such a
guarantee would require persisting selected variants or versioning the catalog.
