const cron = require('node-cron');
const axios = require('axios');
const MonitoredService = require('../models/MonitoredService');
const { createIncident } = require('../services/incidentService');

async function checkService(service) {
  const start = Date.now();
  try {
    const res = await axios.get(service.url, { timeout: 5000 });
    const responseTime = Date.now() - start;

    const wasDown = service.status === 'down';
    service.status = res.status < 400 ? 'healthy' : 'degraded';
    service.consecutiveFailures = 0;
    service.lastResponseTimeMs = responseTime;
    service.lastCheckedAt = new Date();
    await service.save();

    if (wasDown) {
      console.log(`[POLLER] ${service.name} recovered.`);
    }
  } catch (err) {
    service.consecutiveFailures += 1;
    service.lastCheckedAt = new Date();
    service.status = service.consecutiveFailures >= service.failureThreshold ? 'down' : 'degraded';
    await service.save();

    console.log(`[POLLER] ${service.name} check failed (${service.consecutiveFailures}/${service.failureThreshold}): ${err.message}`);

    if (service.consecutiveFailures === service.failureThreshold) {
      console.log(`[POLLER] Threshold crossed for ${service.name} — creating incident.`);
      await createIncident(service);
    }
  }
}

function startHealthPoller() {
  // Runs every 30 seconds. Each service still respects its own
  // checkIntervalSeconds via a lastCheckedAt comparison.
  cron.schedule('*/30 * * * * *', async () => {
    const services = await MonitoredService.find();
    const now = Date.now();

    for (const service of services) {
      const dueForCheck =
        !service.lastCheckedAt ||
        now - new Date(service.lastCheckedAt).getTime() >= service.checkIntervalSeconds * 1000;

      if (dueForCheck) {
        checkService(service).catch(err => console.error('[POLLER] Unexpected error:', err));
      }
    }
  });

  console.log('[POLLER] Health poller started (every 30s).');
}

module.exports = { startHealthPoller, checkService };
