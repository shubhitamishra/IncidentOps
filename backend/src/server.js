require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const servicesRoutes = require('./routes/services');
const incidentsRoutes = require('./routes/incidents');
const oncallRoutes = require('./routes/oncall');
const { startHealthPoller } = require('./jobs/healthPoller');

const app = express();
app.use(cors());
app.use(express.json());

// Simple self health-check endpoint — used both for k8s liveness probes
// AND as a demo target (you can point the poller at another replica of
// this same service to demonstrate self-healing).
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/services', servicesRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/oncall', oncallRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/incidentops';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('[DB] Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`[SERVER] IncidentOps backend running on port ${PORT}`);
      startHealthPoller();
    });
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });
