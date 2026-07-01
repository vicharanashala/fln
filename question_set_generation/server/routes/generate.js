const express = require("express");
const { randomUUID } = require("crypto");
const GenerationJob = require("../models/GenerationJob");

const router = express.Router();
const VALID_CLASS_LEVELS = GenerationJob.CLASS_LEVELS;
const MAX_TOTAL_SETS = Number(process.env.MAX_TOTAL_SETS || 50000);
const TICK_MS = Number(process.env.JOB_TICK_MS || 1000);
const OUTPUT_FOLDER_PATH =
  process.env.OUTPUT_FOLDER_PATH || "Browser controlled Downloads folder";
const memoryJobs = new Map();

function isMongoReady() {
  return GenerationJob.db.readyState === 1;
}

function toClient(job) {
  return {
    jobId: job.jobId,
    classLevel: job.classLevel,
    totalSets: job.totalSets,
    total: job.totalSets,
    completed: job.completed,
    status: job.status,
    outputFolderPath: job.outputFolderPath,
    errors: job.errors || [],
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelledAt: job.cancelledAt,
    failedAt: job.failedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function advance(job) {
  if (job.status !== "running") {
    return job;
  }

  const startedAt = new Date(job.startedAt).getTime();
  const elapsedTicks = Math.max(0, Math.floor((Date.now() - startedAt) / TICK_MS));
  const step = Math.max(1, Math.ceil(job.totalSets / 30));
  const completed = Math.min(job.totalSets, elapsedTicks * step);

  job.completed = completed;
  if (completed >= job.totalSets) {
    job.status = "completed";
    job.completedAt = new Date();
  }
  return job;
}

async function persistAdvanced(job) {
  const advanced = advance(job);
  if (!isMongoReady() || !job._id) {
    memoryJobs.set(job.jobId, advanced);
    return advanced;
  }

  if (advanced.status === "completed") {
    await GenerationJob.updateOne(
      { jobId: advanced.jobId, status: "running" },
      {
        $set: {
          completed: advanced.completed,
          status: advanced.status,
          completedAt: advanced.completedAt,
        },
      }
    );
  } else {
    await GenerationJob.updateOne(
      { jobId: advanced.jobId, status: "running" },
      { $set: { completed: advanced.completed } }
    );
  }

  return advanced;
}

router.post(["/start", "/batch"], async (req, res) => {
  try {
    const { classLevel, totalSets, outputFolderPath } = req.body;
    const parsedTotal = Number(totalSets);

    if (!VALID_CLASS_LEVELS.includes(classLevel)) {
      return res.status(400).json({
        error: `classLevel must be one of: ${VALID_CLASS_LEVELS.join(", ")}`,
      });
    }

    if (!Number.isInteger(parsedTotal) || parsedTotal < 1 || parsedTotal > MAX_TOTAL_SETS) {
      return res.status(400).json({
        error: `totalSets must be an integer between 1 and ${MAX_TOTAL_SETS}.`,
      });
    }

    if (isMongoReady()) {
      const existing = await GenerationJob.findOne({ classLevel, status: "running" }).lean();
      if (existing) {
        return res.status(409).json({
          error: "A job is already running for this class.",
          job: toClient(existing),
        });
      }
    } else {
      const existing = Array.from(memoryJobs.values()).find(
        (job) => job.classLevel === classLevel && advance(job).status === "running"
      );
      if (existing) {
        return res.status(409).json({
          error: "A job is already running for this class.",
          job: toClient(existing),
        });
      }
    }

    const payload = {
      jobId: randomUUID(),
      classLevel,
      totalSets: parsedTotal,
      completed: 0,
      status: "running",
      outputFolderPath: outputFolderPath || OUTPUT_FOLDER_PATH,
      startedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
      failedAt: null,
      errors: [],
    };

    const job = isMongoReady() ? await GenerationJob.create(payload) : payload;
    if (!isMongoReady()) {
      memoryJobs.set(job.jobId, job);
    }

    return res.status(202).json(toClient(job));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A duplicate running job was blocked." });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.get("/progress/:jobId", async (req, res) => {
  try {
    const job = isMongoReady()
      ? await GenerationJob.findOne({ jobId: req.params.jobId })
      : memoryJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    const advanced = await persistAdvanced(job);
    return res.json(toClient(advanced));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/cancel/:jobId", async (req, res) => {
  try {
    const cancelledAt = new Date();
    const update = {
      $set: {
        status: "cancelled",
        cancelledAt,
      },
      $push: { errors: "Job cancelled by operator." },
    };

    const job = isMongoReady()
      ? await GenerationJob.findOneAndUpdate(
          { jobId: req.params.jobId, status: "running" },
          update,
          { new: true }
        )
      : memoryJobs.get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: "Running job not found." });
    }

    if (!isMongoReady()) {
      job.status = "cancelled";
      job.cancelledAt = cancelledAt;
      job.errors = [...(job.errors || []), "Job cancelled by operator."];
      memoryJobs.set(job.jobId, job);
    }

    return res.json(toClient(job));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const jobs = isMongoReady()
      ? await GenerationJob.find({}).sort({ startedAt: -1 }).limit(limit).lean()
      : Array.from(memoryJobs.values())
          .map(advance)
          .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
          .slice(0, limit);

    return res.json(jobs.map(toClient));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/download-path", (req, res) => {
  return res.json({ outputFolderPath: OUTPUT_FOLDER_PATH });
});

module.exports = router;
