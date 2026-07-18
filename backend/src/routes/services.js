const express = require('express');
const router = express.Router();
const MonitoredService = require('../models/MonitoredService');

router.get('/', async (req, res) => {
  const services = await MonitoredService.find().sort('-createdAt');
  res.json(services);
});

router.post('/', async (req, res) => {
  try {
    const service = new MonitoredService(req.body);
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  await MonitoredService.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

module.exports = router;
