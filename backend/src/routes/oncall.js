const express = require('express');
const router = express.Router();
const OnCallMember = require('../models/OnCallMember');
const { getCurrentOnCall } = require('../services/onCallService');

router.get('/', async (req, res) => {
  const members = await OnCallMember.find().sort('rotationOrder');
  res.json(members);
});

router.get('/current', async (req, res) => {
  const current = await getCurrentOnCall();
  res.json(current);
});

router.post('/', async (req, res) => {
  try {
    const member = new OnCallMember(req.body);
    await member.save();
    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  await OnCallMember.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

module.exports = router;
