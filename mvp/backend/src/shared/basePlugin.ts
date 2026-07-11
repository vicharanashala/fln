import type { Schema } from 'mongoose';

/**
 * Shared schema plugin: expose a clean JSON shape to the API layer —
 * `id` instead of `_id`, and drop `__v`. Applied to every model so responses
 * are consistent and never leak Mongo internals.
 */
export function basePlugin(schema: Schema): void {
  const transform = (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  };
  schema.set('toJSON', { virtuals: true, versionKey: false, transform });
  schema.set('toObject', { virtuals: true, versionKey: false, transform });
}
