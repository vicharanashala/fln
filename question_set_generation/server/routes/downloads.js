const express = require("express");
const DownloadLog = require("../models/DownloadLog");

const router = express.Router();
const VALID_CLASS_LEVELS = DownloadLog.CLASS_LEVELS;
const VALID_FILE_TYPES = DownloadLog.FILE_TYPES;
const memoryLogs = [];

function isMongoReady() {
  return DownloadLog.db.readyState === 1;
}

function createMemoryLog(payload) {
  const now = new Date();
  return {
    _id: `memory_${now.getTime()}_${Math.random().toString(16).slice(2)}`,
    ...payload,
    downloadedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * POST /api/downloads
 * Logs a single completed client-side download.
 * Body: { classLevel, fileType, fileName, filePath?, totalQuestions? }
 */
router.post("/", async (req, res) => {
  try {
    const {
      classLevel,
      fileType,
      fileName,
      filePath,
      outputFolderPath,
      totalQuestions,
    } = req.body;

    if (!classLevel || !VALID_CLASS_LEVELS.includes(classLevel)) {
      return res.status(400).json({
        error: `classLevel must be one of: ${VALID_CLASS_LEVELS.join(", ")}`,
      });
    }

    if (!fileType || !VALID_FILE_TYPES.includes(fileType)) {
      return res.status(400).json({
        error: `fileType must be one of: ${VALID_FILE_TYPES.join(", ")}`,
      });
    }

    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "fileName is required." });
    }

    const payload = {
      classLevel,
      fileType,
      fileName,
      filePath: filePath || "",
      outputFolderPath: outputFolderPath || process.env.OUTPUT_FOLDER_PATH || "",
      totalQuestions:
        typeof totalQuestions === "number" ? totalQuestions : null,
    };

    const log = isMongoReady()
      ? await DownloadLog.create(payload)
      : createMemoryLog(payload);

    if (!isMongoReady()) {
      memoryLogs.unshift(log);
    }

    return res.status(201).json(log);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/downloads
 * Lists logged downloads, newest first.
 * Optional query: ?classLevel=CLASS_2
 */
router.get("/", async (req, res) => {
  try {
    const { classLevel } = req.query;
    const filter = {};

    if (classLevel) {
      if (!VALID_CLASS_LEVELS.includes(classLevel)) {
        return res.status(400).json({
          error: `classLevel must be one of: ${VALID_CLASS_LEVELS.join(", ")}`,
        });
      }
      filter.classLevel = classLevel;
    }

    const logs = isMongoReady()
      ? await DownloadLog.find(filter).sort({ downloadedAt: -1 }).limit(500)
      : memoryLogs
          .filter((log) => !classLevel || log.classLevel === classLevel)
          .slice(0, 500);

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/downloads/:id
 * Removes a single log entry (does not touch the file on disk).
 */
router.delete("/:id", async (req, res) => {
  try {
    if (!isMongoReady()) {
      const index = memoryLogs.findIndex((log) => log._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: "Log entry not found." });
      }
      memoryLogs.splice(index, 1);
      return res.json({ deleted: true, id: req.params.id });
    }

    const deleted = await DownloadLog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Log entry not found." });
    }
    return res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
