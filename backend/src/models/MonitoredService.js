const mongoose = require('mongoose');

const monitoredServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  checkIntervalSeconds: { type: Number, default: 30 },
  failureThreshold: { type: Number, default: 3 }, // consecutive failures before incident
  consecutiveFailures: { type: Number, default: 0 },
  status: { type: String, enum: ['healthy', 'degraded', 'down'], default: 'healthy' },
  lastCheckedAt: { type: Date },
  lastResponseTimeMs: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MonitoredService', monitoredServiceSchema);
