# AWS Integration — SNS Alert Fanout

This folder contains the AWS Lambda function used for multi-channel alert
delivery (email + SMS via a single SNS topic).

## Why SNS + Lambda here (not forced)
Nodemailer alone only sends email. Real incident tools alert across
multiple channels. SNS lets one `publish()` call fan out to every
subscriber (email, SMS, and — if extended — a Slack webhook via an SNS
subscription), which is exactly the problem SNS was built to solve.

## Setup (all AWS Free Tier eligible)

1. Create an SNS topic:
   ```
   aws sns create-topic --name incidentops-alerts
   ```
2. Subscribe your email/phone:
   ```
   aws sns subscribe --topic-arn <topic-arn> --protocol email --notification-endpoint you@example.com
   ```
3. Deploy the Lambda:
   ```
   cd aws
   npm init -y
   npm install @aws-sdk/client-sns
   zip -r function.zip snsAlertLambda.js node_modules package.json
   aws lambda create-function \
     --function-name incidentops-sns-alert \
     --runtime nodejs20.x \
     --handler snsAlertLambda.handler \
     --zip-file fileb://function.zip \
     --role <your-lambda-execution-role-arn> \
     --environment "Variables={SNS_TOPIC_ARN=<topic-arn>}"
   ```
4. Attach an API Gateway HTTP API trigger to the Lambda, and set that
   endpoint URL in the backend's `.env` as `AWS_LAMBDA_ALERT_URL` (see
   `backend/src/services/alertService.js` for where to wire it in).

## Free-tier note
Lambda: 1M requests/month free. SNS: 1,000 email notifications free/month,
100 SMS free (region-dependent). This workload is nowhere near those
limits for a demo or small team.
