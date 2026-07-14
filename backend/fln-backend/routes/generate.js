const express = require('express');
const router = express.Router();
const { createBatch, failBatch, processBatch, getBatchStatus } = require('../services/batchProcessor');

/**
 * POST /api/generate-batch
 * Body: [{ studentName, rollNumber, levelId, sublevelId?, setsPerSub? }, ...]
 *
 * Returns a batch id immediately; rendering continues in the background.
 * rosters you may prefer to fire this and poll /api/batch-status/:batchId
 * from a second request instead — the status map is updated as jobs
 * complete, so a fire-and-poll variant is a small change (kick off
 * processBatch without awaiting, return the batchId immediately). Kept
 * synchronous here for simplicity/predictability of the response.
 */
router.post('/generate-batch', async (req, res) => {
  const roster = req.body;

  if (!Array.isArray(roster) || roster.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of student entries.' });
  }

  for (const [i, entry] of roster.entries()) {
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ error: `Entry at index ${i} is not an object.` });
    }
    if (entry.levelId === undefined || entry.levelId === null || isNaN(Number(entry.levelId))) {
      return res.status(400).json({ error: `Entry at index ${i} is missing a numeric levelId.` });
    }
    if (!entry.studentName) {
      return res.status(400).json({ error: `Entry at index ${i} is missing studentName.` });
    }
  }

  const batchId = createBatch();
  processBatch(roster, batchId).catch((err) => {
    console.error('[routes/generate] batch failed:', err);
    failBatch(batchId, err);
  });

  res.status(202).json({
    batchId,
    studentsProcessed: roster.length,
    totalFiles: 0,
    errors: []
  });
});

/**
 * GET /api/batch-status/:batchId
 * Returns { status, processed, total, message, startedAt, finishedAt? }.
 */
router.get('/batch-status/:batchId', (req, res) => {
  const status = getBatchStatus(req.params.batchId);
  if (!status) return res.status(404).json({ error: 'Batch not found.' });
  res.json(status);
});

module.exports = router;
