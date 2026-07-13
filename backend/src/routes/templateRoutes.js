const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/templateController");

router.use(requireAuth);

router.get("/:assessmentId", ctrl.getTemplate);
router.put("/:assessmentId", ctrl.saveTemplate);
router.post("/:assessmentId/approve", ctrl.approveTemplate);
router.post("/:assessmentId/regenerate/:questionIndex", ctrl.regenerateOne);
router.delete("/:assessmentId", ctrl.deleteTemplate);

module.exports = router;