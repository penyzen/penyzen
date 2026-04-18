import { renderEmail } from '@penyzen/email-templates';
import type { WelcomeUserPayload } from '@penyzen/shared';
import { sendEmail } from '../ses/sesClient';

export async function processWelcomeUser(payload: WelcomeUserPayload): Promise<void> {
  const email = renderEmail('welcome', {
    subject: `Welcome to Penyzen, ${payload.userName}!`,
    name: payload.userName,
  });

  await sendEmail({
    to: payload.userEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
