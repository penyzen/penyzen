import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface QueueStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
}

export class QueueStack extends cdk.Stack {
  public readonly notificationQueue: sqs.Queue;
  public readonly notificationDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: QueueStackProps) {
    super(scope, id, props);

    // Dead Letter Queue for failed notification events
    this.notificationDlq = new sqs.Queue(this, 'NotificationDlq', {
      queueName: `penyzen-notifications-dlq-${props.envName}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Main notification queue
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
      queueName: `penyzen-notifications-${props.envName}`,
      visibilityTimeout: cdk.Duration.seconds(60), // Must be >= Lambda timeout
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.notificationDlq,
        maxReceiveCount: 3, // Retry 3x before moving to DLQ
      },
    });

    // Alarm when DLQ has any messages — indicates persistent failures
    new cloudwatch.Alarm(this, 'DlqAlarm', {
      alarmName: `penyzen-notifications-dlq-${props.envName}`,
      alarmDescription: 'Messages in notification DLQ — investigate failed events',
      metric: this.notificationDlq.metricNumberOfMessagesSent({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new cdk.CfnOutput(this, 'NotificationQueueUrl', {
      value: this.notificationQueue.queueUrl,
      exportName: `penyzen-notification-queue-url-${props.envName}`,
    });

    new cdk.CfnOutput(this, 'NotificationQueueArn', {
      value: this.notificationQueue.queueArn,
      exportName: `penyzen-notification-queue-arn-${props.envName}`,
    });
  }
}
