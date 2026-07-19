# IncidentOps — AWS Lambda + SNS Integration

## What This Does

When an incident fires, the IncidentOps backend can dispatch alerts through
two parallel channels:

1. **Email** (direct SMTP via nodemailer)
2. **AWS SNS fanout** (via this Lambda + API Gateway)

Using SNS here is a genuine architectural choice: you publish once to a topic,
and SNS delivers to all subscribers — email, SMS, Slack webhook, etc. Adding
a new alert channel means adding an SNS subscription, not changing backend code.

---

## Architecture

```
IncidentOps Backend
       │
       │  POST /alert  (HTTP)
       ▼
  API Gateway  →  Lambda (snsAlertLambda.js)  →  SNS Topic
                                                       │
                                            ┌──────────┼──────────┐
                                            ▼          ▼          ▼
                                          Email       SMS       Slack
                                                              (webhook)
```

---

## Deployment (No AWS CLI Required)

### Prerequisites

1. **AWS Account** — free tier is fine
2. **IAM User** with programmatic access:
   - Go to: IAM → Users → your user → Security credentials → Create access key
   - Copy the Access Key ID and Secret Access Key
3. **IAM Role for Lambda**:
   - Go to: IAM → Roles → Create role → AWS Service → Lambda
   - Attach policies: `AWSLambdaBasicExecutionRole` + `AmazonSNSFullAccess`
   - Copy the Role ARN (looks like: `arn:aws:iam::123456789:role/lambda-sns-role`)

### Set Environment Variables

```powershell
# Windows PowerShell
$env:AWS_ACCESS_KEY_ID     = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "your-secret..."
$env:AWS_REGION            = "ap-south-1"   # or us-east-1 etc.
$env:ALERT_EMAIL           = "you@example.com"
$env:LAMBDA_ROLE_ARN       = "arn:aws:iam::123456789:role/lambda-sns-role"
```

### Run the Deploy Script

```powershell
cd aws
node deploy.js
```

This will:
1. Create the SNS topic `incidentops-alerts`
2. Subscribe your email (check inbox + click confirmation link!)
3. Upload `function.zip` as a Lambda function (Node 20.x)
4. Create an API Gateway HTTP API pointing to the Lambda
5. Print the `AWS_LAMBDA_ALERT_URL` to add to your `backend/.env`

### Update backend/.env

```bash
AWS_LAMBDA_ALERT_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/alert
```

Then restart the backend:

```bash
docker compose restart backend
```

---

## Testing

Create an incident (or wait for the broken service poller to fire one), then
check backend logs:

```
[ALERT] -> shubhita@example.com | 🚨 Incident: Broken Service is down
[ALERT] email: not configured — logging only (demo mode).
[ALERT] awsSns: delivered ✓
```

And check your email — you should receive the SNS notification within seconds.

---

## Files

| File | Purpose |
|---|---|
| `snsAlertLambda.js` | Lambda handler — receives incident payload, publishes to SNS |
| `deploy.js` | Deployment script using AWS SDK (no AWS CLI required) |
| `package.json` | Node dependencies (`@aws-sdk/client-sns`, `client-lambda`, `client-apigatewayv2`) |
| `function.zip` | Pre-built Lambda deployment package (run `node deploy.js` to upload) |

---

## Free Tier Usage

All resources stay within AWS Free Tier:
- **Lambda**: 1M free requests/month
- **SNS**: 1M free publishes/month, first 1000 email deliveries free
- **API Gateway**: 1M HTTP API calls/month free for 12 months
