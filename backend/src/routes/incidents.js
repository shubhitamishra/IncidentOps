const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const { acknowledgeIncident, resolveIncident } = require('../services/incidentService');

router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const incidents = await Incident.find(filter).sort('-createdAt');
  res.json(incidents);
});

router.get('/:id', async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Not found' });
  res.json(incident);
});

router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { actor } = req.body;
    const incident = await acknowledgeIncident(req.params.id, actor || 'unknown');
    res.json(incident);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { actor, note } = req.body;
    const incident = await resolveIncident(req.params.id, actor || 'unknown', note);
    res.json(incident);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
