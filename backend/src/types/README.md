# types

## Overview
Shared enumerations, validators, and derived names for authoring question templates. Describes the shape of a question (number ranges, operations, answer format) rather than its stem text.

## Interface
- `questionTemplateParams.ts`: constant lists `NUMERAL_RANGES`, `DEPRECATED_NUMERAL_RANGES`, `DIGIT_COUNTS`, `OPERATIONS`, `CARRY_BEHAVIORS`, `BORROW_BEHAVIORS`, `MAX_SUM_OR_DIFFERENCES`, `MAX_OPERAND_COUNTS`, `ANSWER_TYPES`, `QUESTION_FAMILIES`, `PARAM_MODES`, `SUBJECT_CATEGORIES`; the derived union types (`NumeralRange`, `DigitCount`, ...); and the validators and naming helpers for a template's parameters: `QuestionTemplateParams`, `EMPTY_PARAMS`, `hasAnyParam`, `coerceParams`, `validateParams`, `deriveTemplateName`, `variantKeyFor`, `validateGenerationIntent`, `getParamCatalog`. Numeric limits authoring depends on: `INTENT_MIN_CHARS` (20) and `INTENT_MAX_CHARS` (2000), `MAX_SVG_THEMES` (12), `BLANK_COUNT_MIN`/`BLANK_COUNT_MAX` (1 to 6), `QUESTION_COUNT_MIN`/`QUESTION_COUNT_MAX`/`QUESTION_COUNT_DEFAULT` (1, 50, 10).

## Invariants
- The `as const` arrays are the single source for allowed values; types are derived from them.
- `0-100` and `0-1000` are listed in `DEPRECATED_NUMERAL_RANGES` but remain in `NUMERAL_RANGES`; new authoring should avoid them.
- Param modes are `structured`, `legacy-free-text`, `hybrid`; existing free-text templates stay valid.

## Side Effects
- None. Pure declarations and functions.

## Verification
- Run: `npm test --workspace @fln/backend`
- Exercised by `services/questionTemplateRenderer.test.ts` and `tests/question-template-*.test.ts`.
