/**
 * AWS Lambda: snsAlertLambda
 *
 * Purpose: receives an incident payload (via API Gateway) from the
 * IncidentOps backend and fans it out to an SNS topic, which can have
 * multiple subscribers (email, SMS, Slack webhook via subscription).
 *
 * This is the AWS piece of the architecture: the Node backend calls this
 * Lambda's API Gateway endpoint instead of (or in addition to) sending
 * email directly, demonstrating a genuine serverless integration rather
 * than a forced one — SNS is the right tool for multi-channel fanout.
 *
 * Deploy: zip this file, upload as a Lambda function (Node 20.x runtime),
 * attach an API Gateway HTTP trigger, and set the SNS_TOPIC_ARN env var.
 */

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

exports.handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { serviceName, title, severity, assignedTo } = body;

    const message = `[${severity?.toUpperCase() || 'HIGH'}] ${title}\nService: ${serviceName}\nAssigned to: ${assignedTo || 'unassigned'}`;

    await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: `IncidentOps Alert: ${serviceName}`,
      Message: message
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ delivered: true })
    };
  } catch (err) {
    console.error('SNS publish failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ delivered: false, error: err.message })
    };
  }
};
