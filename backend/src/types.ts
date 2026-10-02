// Compatibility barrel for backend/src/db.ts and existing consumers.
// The domain files live directly under backend/src by design.

export * from './identity.types';
export * from './student.types';
export * from './curriculum.types';
export * from './assessment.types';
export * from './evaluation.types';
export * from './operations.types';
