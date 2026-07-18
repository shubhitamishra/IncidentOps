const nodemailer = require('nodemailer');
const axios = require('axios');

// ─── Email (nodemailer) ───────────────────────────────────────────────────────
// In production this would call AWS SES. For the free-tier demo we use
// nodemailer with Gmail (or log-only mode if no credentials are configured,
// so the app never breaks in a demo environment).
const emailEnabled = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ─── AWS Lambda / SNS fanout ──────────────────────────────────────────────────
// If AWS_LAMBDA_ALERT_URL is set, the backend POSTs the incident payload to the
// deployed Lambda (which then publishes to SNS → email + SMS subscribers).
// This is additive — both email and SNS run in parallel when both are configured.
const lambdaUrl = process.env.AWS_LAMBDA_ALERT_URL;

async function sendAlert({ to, subject, message, incidentMeta }) {
  console.log(`[ALERT] -> ${to} | ${subject}`);

  const results = {};

  // ── Channel 1: email ──────────────────────────────────────────────────────
  if (!emailEnabled) {
    console.log('[ALERT] email: not configured — logging only (demo mode).');
    results.email = { delivered: false, mode: 'log-only' };
  } else {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        text: message
      });
      console.log('[ALERT] email: delivered ✓');
      results.email = { delivered: true, mode: 'email' };
    } catch (err) {
      console.error('[ALERT] email: failed —', err.message);
      results.email = { delivered: false, mode: 'error', error: err.message };
    }
  }

  // ── Channel 2: AWS Lambda → SNS fanout ───────────────────────────────────
  if (!lambdaUrl) {
    console.log('[ALERT] awsSns: not configured — skipping (set AWS_LAMBDA_ALERT_URL to enable).');
    results.awsSns = { delivered: false, mode: 'not-configured' };
  } else {
    try {
      const payload = incidentMeta || { title: subject, serviceName: to, severity: 'high', assignedTo: to };
      const res = await axios.post(lambdaUrl, payload, { timeout: 8000 });
      const delivered = res.data?.delivered === true;
      console.log(`[ALERT] awsSns: ${delivered ? 'delivered ✓' : 'not delivered'}`);
      results.awsSns = { delivered, mode: 'lambda-sns', response: res.data };
    } catch (err) {
      console.error('[ALERT] awsSns: Lambda call failed —', err.message);
      results.awsSns = { delivered: false, mode: 'error', error: err.message };
    }
  }

  return results;
}

module.exports = { sendAlert };
