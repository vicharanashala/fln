const express = require('express');
const router = express.Router();
const { SVGAsset, AssetSubstitutionLog } = require('../models/SVGAsset');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const assets = await SVGAsset.find(filter).sort({ category: 1, name: 1 });
    res.json({ assets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

router.get('/substitution-log', auth, async (req, res) => {
  try {
    const logs = await AssetSubstitutionLog.find()
      .populate('worksheet')
      .sort({ loggedAt: -1 })
      .limit(100);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get substitution log' });
  }
});

module.exports = router;
