const Incident = require('../models/Incident');
const { getCurrentOnCall, getNextInRotation } = require('./onCallService');
const { sendAlert } = require('./alertService');
const { mirrorEvent } = require('../integrations/cloudantAudit');

const ESCALATION_TIMEOUT_MS = (process.env.ESCALATION_TIMEOUT_MINUTES || 5) * 60 * 1000;

/**
 * Creates a new incident for a failing service and alerts the current
 * on-call member. Called by the health poller when a service crosses
 * its failure threshold.
 */
async function createIncident(service) {
  const onCall = await getCurrentOnCall();

  const incident = new Incident({
    service: service._id,
    serviceName: service.name,
    title: `${service.name} is DOWN (${service.consecutiveFailures} consecutive failed checks)`,
    severity: service.consecutiveFailures >= service.failureThreshold * 2 ? 'critical' : 'high',
    assignedTo: onCall ? onCall.name : null,
    timeline: [{
      type: 'created',
      message: `Auto-detected by health poller after ${service.consecutiveFailures} failed checks`,
      actor: 'system'
    }]
  });

  await incident.save();
  await mirrorEvent(incident._id, incident.timeline[0].toObject());

  if (onCall) {
    await sendAlert({
      to: onCall.email,
      subject: `🚨 Incident: ${service.name} is down`,
      message: `${service.name} failed ${service.consecutiveFailures} consecutive health checks. Please acknowledge in the dashboard.`,
      // incidentMeta is forwarded to the AWS Lambda so SNS gets a rich payload
      incidentMeta: {
        title: incident.title,
        serviceName: incident.serviceName,
        severity: incident.severity,
        assignedTo: incident.assignedTo
      }
    });

    incident.timeline.push({
      type: 'note',
      message: `Alert dispatched to ${onCall.name} (${onCall.email})`,
      actor: 'system'
    });
    await incident.save();
  }

  // Schedule escalation check
  scheduleEscalationCheck(incident._id);

  return incident;
}

/**
 * Waits ESCALATION_TIMEOUT_MS, then checks whether the incident has been
 * acknowledged. If not, escalates to the next person in rotation.
 * In a full production system this would be a durable queue (e.g. SQS),
 * but a timer is transparent and sufficient to demo the concept correctly.
 */
function scheduleEscalationCheck(incidentId) {
  setTimeout(async () => {
    const incident = await Incident.findById(incidentId);
    if (!incident || incident.status !== 'open') return; // already handled

    const onCall = await getCurrentOnCall();
    const next = onCall ? await getNextInRotation(onCall._id) : null;

    incident.escalationLevel += 1;
    incident.assignedTo = next ? next.name : incident.assignedTo;
    incident.timeline.push({
      type: 'escalated',
      message: `Not acknowledged within ${ESCALATION_TIMEOUT_MS / 60000} min — escalated to ${next ? next.name : 'no one (all tried)'}`,
      actor: 'system'
    });
    await incident.save();

    if (next) {
      await sendAlert({
        to: next.email,
        subject: `🚨 ESCALATED Incident: ${incident.serviceName} is down`,
        message: `This incident was not acknowledged and has been escalated to you.`,
        incidentMeta: {
          title: incident.title,
          serviceName: incident.serviceName,
          severity: incident.severity,
          assignedTo: next.name
        }
      });
      scheduleEscalationCheck(incident._id); // keep escalating if still unacked
    }
  }, ESCALATION_TIMEOUT_MS);
}

async function acknowledgeIncident(incidentId, actor) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new Error('Incident not found');

  incident.status = 'acknowledged';
  incident.acknowledgedAt = new Date();
  incident.timeline.push({ type: 'acknowledged', message: `Acknowledged by ${actor}`, actor });
  await incident.save();
  await mirrorEvent(incident._id, incident.timeline[incident.timeline.length - 1].toObject());
  return incident;
}

async function resolveIncident(incidentId, actor, note) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new Error('Incident not found');

  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  incident.timeline.push({
    type: 'resolved',
    message: note || `Resolved by ${actor}`,
    actor
  });
  await incident.save();
  await mirrorEvent(incident._id, incident.timeline[incident.timeline.length - 1].toObject());
  return incident;
}

module.exports = { createIncident, acknowledgeIncident, resolveIncident };
