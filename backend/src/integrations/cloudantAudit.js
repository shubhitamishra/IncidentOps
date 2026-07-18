/**
 * IBM Cloudant integration — mirrors every incident timeline event to a
 * separate audit-log database.
 *
 * Why Cloudant here specifically: incident timelines (created →
 * acknowledged → resolved) are exactly the kind of append-only,
 * document-shaped event log Cloudant/CouchDB is designed for, and
 * keeping the audit trail in a separate managed store means it survives
 * even if the primary MongoDB instance has an issue — a genuine
 * resilience argument, not just "using IBM because it's required."
 *
 * If IBM_CLOUDANT_URL / IBM_CLOUDANT_APIKEY are not set, this module
 * no-ops safely so local development and demos never break.
 */

const axios = require('axios');

const CLOUDANT_URL = process.env.IBM_CLOUDANT_URL;
const CLOUDANT_APIKEY = process.env.IBM_CLOUDANT_APIKEY;
const DB_NAME = 'incident_audit_log';

const enabled = !!(CLOUDANT_URL && CLOUDANT_APIKEY);

async function getIamToken() {
  const res = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: CLOUDANT_APIKEY
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

async function mirrorEvent(incidentId, event) {
  if (!enabled) {
    console.log('[CLOUDANT] Not configured — skipping audit mirror (demo mode).');
    return;
  }

  try {
    const token = await getIamToken();
    await axios.post(
      `${CLOUDANT_URL}/${DB_NAME}`,
      {
        incidentId: incidentId.toString(),
        ...event,
        mirroredAt: new Date().toISOString()
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[CLOUDANT] Failed to mirror event:', err.message);
  }
}

module.exports = { mirrorEvent, enabled };
