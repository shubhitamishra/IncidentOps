/**
 * IBM Cloudant / CouchDB integration — mirrors every incident timeline event
 * to a separate audit-log database.
 *
 * Why Cloudant/CouchDB here: incident timelines are append-only, document-
 * shaped events — exactly what CouchDB was designed for. Keeping the audit
 * trail in a separate managed store means it survives even if MongoDB has
 * an issue — a genuine resilience argument.
 *
 * Auth modes (auto-detected):
 *   - CouchDB basic auth: set IBM_CLOUDANT_URL + IBM_CLOUDANT_USER + IBM_CLOUDANT_PASSWORD
 *     (used in local demo / docker-compose with the CouchDB container)
 *   - IBM Cloudant IAM:   set IBM_CLOUDANT_URL + IBM_CLOUDANT_APIKEY
 *     (used in production against a real IBM Cloudant instance)
 *
 * If none of the above are set, this module no-ops safely so local
 * development and demos never break.
 */

const axios = require('axios');

const CLOUDANT_URL      = process.env.IBM_CLOUDANT_URL;
const CLOUDANT_APIKEY   = process.env.IBM_CLOUDANT_APIKEY;
const CLOUDANT_USER     = process.env.IBM_CLOUDANT_USER;
const CLOUDANT_PASSWORD = process.env.IBM_CLOUDANT_PASSWORD;
const DB_NAME = 'incident_audit_log';

const useBasicAuth = !!(CLOUDANT_URL && CLOUDANT_USER && CLOUDANT_PASSWORD);
const useIamAuth   = !!(CLOUDANT_URL && CLOUDANT_APIKEY);
const enabled      = useBasicAuth || useIamAuth;

// IAM token cache (only used in Cloudant mode)
let _cachedToken = null;
let _tokenExpiry = 0;

async function getAuthHeader() {
  if (useBasicAuth) {
    // CouchDB basic auth — works locally and on any self-hosted CouchDB
    const encoded = Buffer.from(`${CLOUDANT_USER}:${CLOUDANT_PASSWORD}`).toString('base64');
    return `Basic ${encoded}`;
  }

  // IBM Cloudant IAM token (re-use if still valid)
  if (_cachedToken && Date.now() < _tokenExpiry) return `Bearer ${_cachedToken}`;
  const res = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: CLOUDANT_APIKEY
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  _cachedToken = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return `Bearer ${_cachedToken}`;
}

// Ensure the audit DB exists (CouchDB returns 412 if already present — fine)
let _dbReady = false;
async function ensureDb(authHeader) {
  if (_dbReady) return;
  try {
    await axios.put(
      `${CLOUDANT_URL}/${DB_NAME}`,
      {},
      { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } }
    );
    console.log(`[CLOUDANT] Database '${DB_NAME}' created.`);
  } catch (err) {
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
    const auth = await getAuthHeader();
    await ensureDb(auth);

    const res = await axios.post(
      `${CLOUDANT_URL}/${DB_NAME}`,
      {
        incidentId: incidentId.toString(),
        ...event,
        mirroredAt: new Date().toISOString()
      },
      { headers: { Authorization: auth, 'Content-Type': 'application/json' } }
    );
    const mode = useBasicAuth ? 'CouchDB (local Cloudant-compatible)' : 'IBM Cloudant';
    console.log(`[CLOUDANT] Event mirrored via ${mode} — doc id: ${res.data.id}`);
  } catch (err) {
    console.error('[CLOUDANT] Failed to mirror event:', err.message);
  }
}

module.exports = { mirrorEvent, enabled };
