const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Logbook = require('../models/Logbook');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'superadmin') {
      filter.submittedBy = req.user._id;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    const tickets = await Ticket.find(filter)
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, type, relatedQuestionId } = req.body;
    if (type === 'curriculum' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can submit curriculum tickets' });
    }
    const ticketId = `TCK-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const ticket = await Ticket.create({
      ticketId, title, description, type,
      submittedBy: req.user._id,
      submittedByRole: req.user.role,
      relatedQuestionId
    });
    await Logbook.create({
      action: 'submit_feedback',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      description: `Submitted ${type} ticket: ${title}`,
    });
    res.status(201).json({ ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.put('/:id/review', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, {
      status, reviewNotes, reviewedBy: req.user._id
    }, { new: true });
    await Logbook.create({
      action: 'resolve_ticket',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      description: `Reviewed ticket ${ticket.ticketId}: ${status}`,
    });
    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review ticket' });
  }
});

module.exports = router;
