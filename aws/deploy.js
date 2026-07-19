/**
 * aws/deploy.js — Deploy IncidentOps Lambda + SNS using AWS SDK for JS
 *
 * Usage:
 *   cd aws
 *   node deploy.js
 *
 * Requires these env vars (set in your shell or backend/.env):
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION           (default: ap-south-1)
 *   ALERT_EMAIL          (email address to subscribe to SNS topic)
 *   LAMBDA_ROLE_ARN      (IAM role ARN with AWSLambdaBasicExecutionRole + SNS publish)
 *
 * What it does:
 *   1. Creates SNS topic "incidentops-alerts" (idempotent)
 *   2. Subscribes ALERT_EMAIL to the topic
 *   3. Creates (or updates) Lambda function "incidentops-sns-alert"
 *   4. Creates API Gateway HTTP API with a POST /alert route
 *   5. Prints the API Gateway URL — add this to backend/.env as AWS_LAMBDA_ALERT_URL
 */

const fs = require('fs');
const path = require('path');
const {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
} = require('@aws-sdk/client-sns');
const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
} = require('@aws-sdk/client-lambda');
const {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateRouteCommand,
  CreateIntegrationCommand,
  CreateStageCommand,
  GetApisCommand,
} = require('@aws-sdk/client-apigatewayv2');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const LAMBDA_ROLE_ARN = process.env.LAMBDA_ROLE_ARN;
const FUNCTION_NAME = 'incidentops-sns-alert';
const TOPIC_NAME = 'incidentops-alerts';
const API_NAME = 'incidentops-alert-api';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('ERROR: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.');
  process.exit(1);
}
if (!LAMBDA_ROLE_ARN) {
  console.error('ERROR: LAMBDA_ROLE_ARN must be set. Create an IAM role with AWSLambdaBasicExecutionRole + SNSPublishPolicy.');
  process.exit(1);
}
if (!ALERT_EMAIL) {
  console.error('ERROR: ALERT_EMAIL must be set (email to receive alerts).');
  process.exit(1);
}

const sns = new SNSClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });
const apigw = new ApiGatewayV2Client({ region: REGION });

async function run() {
  // 1. Create SNS topic
  console.log('\n[1/5] Creating SNS topic...');
  const { TopicArn } = await sns.send(new CreateTopicCommand({ Name: TOPIC_NAME }));
  console.log(`      Topic ARN: ${TopicArn}`);

  // 2. Subscribe email
  console.log(`\n[2/5] Subscribing ${ALERT_EMAIL} to SNS topic...`);
  await sns.send(new SubscribeCommand({
    TopicArn,
    Protocol: 'email',
    Endpoint: ALERT_EMAIL,
  }));
  console.log('      Subscription pending — check your email and confirm the subscription!');

  // 3. Create or update Lambda
  console.log('\n[3/5] Deploying Lambda function...');
  const zipBuffer = fs.readFileSync(path.join(__dirname, 'function.zip'));

  let functionArn;
  try {
    const existing = await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    console.log('      Function exists — updating code...');
    const updated = await lambda.send(new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer,
    }));
    functionArn = updated.FunctionArn;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log('      Creating new function...');
      const created = await lambda.send(new CreateFunctionCommand({
        FunctionName: FUNCTION_NAME,
        Runtime: 'nodejs20.x',
        Role: LAMBDA_ROLE_ARN,
        Handler: 'snsAlertLambda.handler',
        Code: { ZipFile: zipBuffer },
        Environment: {
          Variables: {
            SNS_TOPIC_ARN: TopicArn,
            AWS_REGION: REGION,
          },
        },
        Timeout: 15,
        Description: 'IncidentOps alert fanout via SNS',
      }));
      functionArn = created.FunctionArn;
    } else {
      throw err;
    }
  }
  console.log(`      Function ARN: ${functionArn}`);

  // 4. Create API Gateway HTTP API
  console.log('\n[4/5] Creating API Gateway HTTP API...');
  let apiId, apiEndpoint;
  const apis = await apigw.send(new GetApisCommand({}));
  const existing = apis.Items?.find(a => a.Name === API_NAME);
  if (existing) {
    apiId = existing.ApiId;
    apiEndpoint = existing.ApiEndpoint;
    console.log(`      Reusing existing API: ${apiId}`);
  } else {
    const api = await apigw.send(new CreateApiCommand({
      Name: API_NAME,
      ProtocolType: 'HTTP',
      Target: functionArn,
    }));
    apiId = api.ApiId;
    apiEndpoint = api.ApiEndpoint;
    console.log(`      Created API: ${apiId}`);

    // Add Lambda invoke permission for API Gateway
    await lambda.send(new AddPermissionCommand({
      FunctionName: FUNCTION_NAME,
      StatementId: 'apigateway-invoke',
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: `arn:aws:execute-api:${REGION}:*:${apiId}/*/*`,
    })).catch(() => {}); // ignore if already exists
  }

  const alertUrl = `${apiEndpoint}/alert`;
  console.log(`\n[5/5] Done!`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`SNS Topic ARN:   ${TopicArn}`);
  console.log(`Lambda ARN:      ${functionArn}`);
  console.log(`API Gateway URL: ${apiEndpoint}`);
  console.log('');
  console.log('Add this to backend/.env:');
  console.log(`  AWS_LAMBDA_ALERT_URL=${alertUrl}`);
  console.log('');
  console.log('Then restart the backend:');
  console.log('  docker compose restart backend');
  console.log('');
  console.log('IMPORTANT: Check your email and click the SNS confirmation link!');
  console.log('═══════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('\nDeployment failed:', err.message);
  process.exit(1);
});
