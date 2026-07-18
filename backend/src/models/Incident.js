const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['created', 'acknowledged', 'escalated', 'resolved', 'note'],
    required: true
  },
  message: { type: String },
  actor: { type: String, default: 'system' }, // 'system' or a team member name
  timestamp: { type: Date, default: Date.now }
});

const incidentSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoredService', required: true },
  serviceName: { type: String, required: true },
  title: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'resolved'],
    default: 'open'
  },
  assignedTo: { type: String }, // current on-call member name
  escalationLevel: { type: Number, default: 0 },
  timeline: [timelineEventSchema],
  createdAt: { type: Date, default: Date.now },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date }
});

module.exports = mongoose.model('Incident', incidentSchema);
