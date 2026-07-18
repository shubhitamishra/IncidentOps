/**
 * Quick seed script for demo purposes.
 * Run with: node src/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MonitoredService = require('./models/MonitoredService');
const OnCallMember = require('./models/OnCallMember');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/incidentops');

  await OnCallMember.deleteMany({});
  await OnCallMember.insertMany([
    { name: 'Shubhita', email: 'shubhita@example.com', rotationOrder: 0 },
    { name: 'Backup Engineer', email: 'backup@example.com', rotationOrder: 1 }
  ]);

  await MonitoredService.deleteMany({});
  await MonitoredService.insertMany([
    {
      // Uses Docker Compose service name — reachable from within the container network.
      // DO NOT use localhost here; inside Docker that refers to the container's own loopback.
      name: 'IncidentOps Backend (self-check)',
      url: 'http://incidentops-backend:5000/health',
      checkIntervalSeconds: 30,
      failureThreshold: 3
    },
    {
      name: 'Public Demo API (healthy)',
      url: 'https://httpbin.org/status/200',
      checkIntervalSeconds: 30,
      failureThreshold: 3
    },
    {
      // Intentionally returns 503 — use this for the live incident demo.
      // After 3 consecutive failures (~90s) an incident auto-creates and
      // the on-call member is alerted. Great for live presentations.
      name: 'Broken Service (demo — always 503)',
      url: 'https://httpbin.org/status/503',
      checkIntervalSeconds: 30,
      failureThreshold: 3
    }
  ]);

  console.log('Seed complete. On-call members and demo services created.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
