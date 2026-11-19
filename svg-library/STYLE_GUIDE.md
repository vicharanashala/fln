# Style Guide

These rules keep every illustration in the library recognisable, consistent, cheap to print and ready for
publication.

## 1. Black-and-white line art, minimal ink
- **Outline only.** Shapes are drawn with black strokes on a **white fill**. No colour and no grey tones.
- Solid black is allowed **only in small areas** where it helps recognition: eye pupils, nostrils, a pencil's
  graphite tip, a cow's hooves. Keep solid black under about 3% of the drawing area.
- No hatching, shading or large dark patches. Every illustration should also work as a **colouring page**.
- Stroke weights on the 512 canvas:
  | Line                         | Width |
  |------------------------------|-------|
  | Main silhouette outline      | 8     |
  | Inner details (folds, veins) | 5     |
  | Fine details (whiskers, texture) | 3.5 |
- Always use `stroke-linecap="round"` and `stroke-linejoin="round"`. Stroke colour is `#1A1A1A`.

## 2. Recognisability first
- Show one object, in its most typical shape and viewing angle: an apple with a stem and a leaf, or a cow from
  the side with horns, an udder and a tail.
- **A friendly storybook / cartoon style is welcome**, like the drawings in children's textbooks: simple round
  eyes on animals, soft rounded forms, slightly exaggerated features. Avoid branded or copyrighted characters.
- No text, letters or numbers inside an illustration, unless that is the subject (`numbers-counting/`).
- Test: a 4-year-old should name the object in under 2 seconds.

## 3. Technical rules
- `viewBox="0 0 512 512"`, with no `width`/`height` attributes.
- The object fills about 80–90% of the canvas and is centred, with about 24px padding.
- Must include `<title>` and `<desc>`.
- Only plain shapes and paths. **Not allowed:** `<image>`, bitmaps, external links, fonts, scripts, filters,
  gradients, CSS variables.
- Fills are only `#FFFFFF`, `#1A1A1A` or `none`.
- Aim for under 15 KB per file.

## 4. Naming
- Lowercase kebab-case: `apple.svg`, `cricket-bat.svg`, `school-bag.svg`
- Variants: `cow-sitting.svg`, `mango-sliced.svg`

## 5. Review checklist
- [ ] Instantly recognisable
- [ ] Outline-only, minimal ink
- [ ] Consistent stroke weights
- [ ] Follows the technical rules in §3
- [ ] Named correctly and placed in the right folder
