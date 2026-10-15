import express from 'express';

// Only file-upload POST endpoints need the larger JSON allowance (#755).
const LARGE_BODY_PATHS = [
  '/api/icr/check-quality',
  '/api/icr/evaluate-cloud',
  '/api/icr/evaluate-bulk',
  '/api/students/bulk-import',
  // QuestionTemplatePanel uploads a CSV file inside JSON, too.
  '/api/question-templates/import',
];

export function registerRequestBodyParsers(app: express.Express) {
  // Match whole routes, not prefixes: unrelated descendants and methods must
  // not inherit the upload allowance. Express skips an already-parsed body.
  app.post(LARGE_BODY_PATHS, express.json({ limit: '100mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
}
