const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/assessmentController");

router.use(requireAuth);

router.post("/", upload.array("questionPapers", 30), ctrl.createAssessment);
router.get("/", ctrl.listAssessments);
router.get("/:id", ctrl.getAssessment);
router.post("/:id/generate-template", ctrl.generateTemplate);
router.delete("/:id", ctrl.deleteAssessment);

module.exports = router;