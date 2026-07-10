const mongoose = require('mongoose');

const svgAssetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['fruits', 'animals', 'shapes', 'numbers', 'tracing'],
    required: true
  },
  filePath: { type: String, required: true },
  tags: [{ type: String }],
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

svgAssetSchema.index({ category: 1, name: 1 }, { unique: true });

const assetSubstitutionLogSchema = new mongoose.Schema({
  worksheet: { type: mongoose.Schema.Types.ObjectId, ref: 'Worksheet' },
  requestedAsset: { type: String },
  requestedCategory: { type: String },
  substitutedAsset: { type: String },
  substitutedCategory: { type: String },
  reason: { type: String, default: 'not_found' },
  loggedAt: { type: Date, default: Date.now }
});

module.exports = {
  SVGAsset: mongoose.model('SVGAsset', svgAssetSchema),
  AssetSubstitutionLog: mongoose.model('AssetSubstitutionLog', assetSubstitutionLogSchema)
};
