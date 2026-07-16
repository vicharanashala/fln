const express = require('express');
const router = express.Router();
const { batchExists, zipBatch, sanitize } = require('../services/storage');

/**
 * GET /api/download-batch/:batchId
 * Streams a single ZIP containing every student's folder (worksheet.pdf +
 * answer_key.json + coords.json each) plus the top-level manifest.json.
 */
router.get('/download-batch/:batchId', async (req, res) => {
  const batchId = sanitize(req.params.batchId);

  const exists = await batchExists(batchId);
  if (!exists) {
    return res.status(404).json({ error: 'Batch not found. Has it finished generating?' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}.zip"`);

  try {
    await zipBatch(batchId, res);
  } catch (err) {
    console.error('[routes/download] zip failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

module.exports = router;
