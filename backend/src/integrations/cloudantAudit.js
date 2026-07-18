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

// Cache the IAM token so we don't re-fetch on every event
let _cachedToken = null;
let _tokenExpiry = 0;

async function getIamToken() {
  // Re-use cached token if still valid (IAM tokens last ~1 hour)
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const res = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: CLOUDANT_APIKEY
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  _cachedToken = res.data.access_token;
  // Expire 5 minutes before actual expiry to avoid edge cases
  _tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return _cachedToken;
}

/**
 * Ensures the audit log database exists in Cloudant.
 * CouchDB/Cloudant returns 201 on create, 412 if already exists — both fine.
 */
let _dbReady = false;
async function ensureDb(token) {
  if (_dbReady) return;
  try {
    await axios.put(
      `${CLOUDANT_URL}/${DB_NAME}`,
      {},
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log(`[CLOUDANT] Database '${DB_NAME}' created.`);
  } catch (err) {
    // 412 = already exists — that's fine
    if (err.response?.status === 412) {
      console.log(`[CLOUDANT] Database '${DB_NAME}' already exists.`);
    } else {
      throw err;
    }
  }
  _dbReady = true;
}

async function mirrorEvent(incidentId, event) {
  if (!enabled) {
    console.log('[CLOUDANT] Not configured — skipping audit mirror (demo mode).');
    return;
  }

  try {
    const token = await getIamToken();
    await ensureDb(token);

    const res = await axios.post(
      `${CLOUDANT_URL}/${DB_NAME}`,
      {
        incidentId: incidentId.toString(),
        ...event,
        mirroredAt: new Date().toISOString()
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log(`[CLOUDANT] Event mirrored — doc id: ${res.data.id}`);
  } catch (err) {
    console.error('[CLOUDANT] Failed to mirror event:', err.message);
  }
}

module.exports = { mirrorEvent, enabled };
