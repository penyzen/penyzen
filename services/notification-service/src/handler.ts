import type { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { logger } from '@penyzen/shared';
import type { NotificationEvent } from '@penyzen/shared';
import { processEvent } from './processors';

/**
 * notification-service Lambda entry point.
 *
 * This Lambda is triggered by SQS (NOT API Gateway).
 * SQS sends batches of up to 10 messages. We process each record individually
 * and report partial batch failures so failed messages return to the queue
 * while successfully processed messages are deleted.
 *
 * CDK config: FunctionEventSourceMapping with reportBatchItemFailures = true
 */
export const handler = async (
  event: SQSEvent,
  context: Context,
): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
  logger.info(
    { requestId: context.awsRequestId, recordCount: event.Records.length },
    'notification-service batch',
  );

  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  // Process records in parallel (max 10 in a batch from SQS)
  await Promise.allSettled(
    event.Records.map(async (record: SQSRecord) => {
      try {
        const notificationEvent = parseRecord(record);
        await processEvent(notificationEvent);
        logger.info({ messageId: record.messageId, type: notificationEvent.type }, 'event processed');
      } catch (err) {
        logger.error({ err, messageId: record.messageId }, 'failed to process SQS record');
        // Report failure — SQS will retry this message (up to maxReceiveCount before DLQ)
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }),
  );

  return { batchItemFailures };
};

function parseRecord(record: SQSRecord): NotificationEvent {
  try {
    return JSON.parse(record.body) as NotificationEvent;
  } catch {
    throw new Error(`Invalid JSON in SQS message body: ${record.messageId}`);
  }
}
