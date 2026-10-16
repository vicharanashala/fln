// ---------------------------------------------------------------------------
// Request Body Validation Middleware
// ---------------------------------------------------------------------------
// Validates incoming request bodies against endpoint-specific schemas before
// the route handler runs. Returns a 400 with a structured error response on
// failure, so clients always get a predictable shape:
//   { error: 'validation_error', details: [ { field, message } ] }
//
// Schemas are intentionally small and hand-rolled (no new dependency) to keep
// the backend dependency surface minimal. Each schema validates the fields a
// route actually destructures from req.body; anything extra is ignored.
//
// Mount per-route, e.g.:
//   app.post('/api/tickets/create', validate(ticketCreateSchema), handler);
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';

type ValidationRule<T = unknown> = (value: unknown, ctx: { path: string }) => T | null;
// Returns null when the value is valid; otherwise a human-readable message.

type SchemaField = {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  enum?: string[] | number[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  default?: unknown;
  sanitize?: 'trim' | 'lowercase' | 'none';
};

type Schema = Record<string, SchemaField>;

interface ValidationError {
  field: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Primitive validators                                               */
/* ------------------------------------------------------------------ */

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/* ------------------------------------------------------------------ */
/* Field validator                                                    */
/* ------------------------------------------------------------------ */

function validateField(
  value: unknown,
  field: SchemaField,
  ctx: { path: string },
): string | null {
  const { required = false, type = 'any', default: defVal } = field;

  // Missing value.
  if (value === undefined || value === null) {
    if (required) return `is required`;
    return defVal !== undefined ? null : null; // optional and absent -> valid
  }

  // Apply defaults for optional absent values handled above; if present, coerce.
  let working = value;

  // Type checks.
  if (type === 'string' && !isString(working)) return `must be a string`;
  if (type === 'number' && !isNumber(working)) return `must be a number`;
  if (type === 'boolean' && !isBoolean(working)) return `must be a boolean`;
  if (type === 'object' && !isObject(working)) return `must be an object`;
  if (type === 'array' && !isArray(working)) return `must be an array`;

  // String constraints.
  if (isString(working)) {
    let s = working;
    if (field.sanitize === 'trim') s = s.trim();
    if (field.sanitize === 'lowercase') s = s.toLowerCase();
    if (field.minLength !== undefined && s.length < field.minLength)
      return `must be at least ${field.minLength} characters`;
    if (field.maxLength !== undefined && s.length > field.maxLength)
      return `must be at most ${field.maxLength} characters`;
    if (field.pattern && !field.pattern.test(s)) return `has an invalid format`;
    if (field.enum) {
      const allowed = field.enum as string[];
      if (!allowed.includes(s)) return `must be one of: ${allowed.join(', ')}`;
    }
  }

  // Number constraints.
  if (isNumber(working)) {
    if (field.min !== undefined && working < field.min) return `must be at least ${field.min}`;
    if (field.max !== undefined && working > field.max) return `must be at most ${field.max}`;
    if (field.enum) {
      const allowed = field.enum as number[];
      if (!allowed.includes(working)) return `must be one of: ${allowed.join(', ')}`;
    }
  }

  return null;
}

/**
 * Builds an Express middleware that validates req.body against a schema.
 *
 *   validate({ name: { type: 'string', required: true, minLength: 1 } })
 *
 * Optional fields that are absent are left untouched. Required fields that
 * are missing or have the wrong type produce a 400. String fields are
 * trimmed/lowercased per the `sanitize` hint (coerced back onto req.body).
 */
export function validate(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body;
    if (!isObject(body)) {
      res.status(400).json({
        error: 'validation_error',
        message: 'Request body must be a JSON object',
        details: [],
      });
      return;
    }

    const errors: ValidationError[] = [];
    const sanitized: Record<string, unknown> = { ...body };

    for (const [fieldName, field] of Object.entries(schema)) {
      const ctx = { path: fieldName };
      const value = body[fieldName];
      const err = validateField(value, field, ctx);

      if (err) {
        errors.push({ field: fieldName, message: err });
        continue;
      }

      // Apply sanitization coercion (trim/lowercase) back onto the body so
      // route handlers receive cleaned values.
      if (isString(value)) {
        let s = value;
        if (field.sanitize === 'trim') s = s.trim();
        if (field.sanitize === 'lowercase') s = s.toLowerCase();
        if (s !== value) sanitized[fieldName] = s;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'validation_error',
        message: 'Request validation failed',
        details: errors,
      });
      return;
    }

    req.body = sanitized;
    next();
  };
}

/* ------------------------------------------------------------------ */
/* Reusable schemas                                                   */
/* ------------------------------------------------------------------ */

export const ticketCreateSchema: Schema = {
  type: { type: 'string', enum: ['general', 'curriculum'], required: false, default: 'general' },
  subject: { type: 'string', required: true, minLength: 1, maxLength: 200, sanitize: 'trim' },
  description: { type: 'string', required: true, minLength: 1, maxLength: 5000, sanitize: 'trim' },
};

export const ticketResolveSchema: Schema = {
  status: { type: 'string', enum: ['Reviewed', 'Resolved'], required: true },
};

export const announcementCreateSchema: Schema = {
  title: { type: 'string', required: true, minLength: 1, maxLength: 200, sanitize: 'trim' },
  message: { type: 'string', required: true, minLength: 1, maxLength: 5000, sanitize: 'trim' },
  isUrgent: { type: 'boolean', required: false, default: false },
};

export const studentRegisterSchema: Schema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 100, sanitize: 'trim' },
  age: { type: 'number', required: true, min: 4, max: 20 },
  classGroup: { type: 'string', required: true, minLength: 1, maxLength: 30, sanitize: 'trim' },
  section: { type: 'string', required: true, minLength: 1, maxLength: 10, sanitize: 'trim' },
  aadharNumber: { type: 'string', required: false, minLength: 0, maxLength: 12, sanitize: 'trim' },
  address: { type: 'string', required: false, maxLength: 500, sanitize: 'trim' },
};

export const evaluationSubmitSchema: Schema = {
  worksheetId: { type: 'string', required: true, minLength: 1, sanitize: 'trim' },
  studentId: { type: 'string', required: true, minLength: 1, sanitize: 'trim' },
  answers: { type: 'object', required: true },
};

export const questionFlagReviewSchema: Schema = {
  action: { type: 'string', required: true, enum: ['dismiss', 'revise', 'keep'] },
  reviewNote: { type: 'string', required: false, maxLength: 1000, sanitize: 'trim' },
};
