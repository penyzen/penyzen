import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from '@penyzen/shared';

const ses = new SESv2Client({
  region: process.env['SES_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1',
});

const FROM_EMAIL = process.env['SES_FROM_EMAIL'] ?? 'noreply@penyzen.com';
const REPLY_TO = process.env['SES_REPLY_TO'] ?? 'support@penyzen.com';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

  // SES batch limit is 50 recipients per call — chunk if needed
  const chunks: string[][] = [];
  for (let i = 0; i < toAddresses.length; i += 50) {
    chunks.push(toAddresses.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const command = new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      ReplyToAddresses: [REPLY_TO],
      Destination: { ToAddresses: chunk },
      Content: {
        Simple: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: options.html, Charset: 'UTF-8' },
            Text: { Data: options.text, Charset: 'UTF-8' },
          },
        },
      },
    });

    try {
      await ses.send(command);
      logger.info({ to: chunk, subject: options.subject }, 'email sent');
    } catch (err) {
      logger.error({ err, to: chunk, subject: options.subject }, 'email send failed');
      throw err;
    }
  }
}
