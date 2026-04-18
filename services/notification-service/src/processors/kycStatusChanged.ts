import { renderEmail } from '@penyzen/email-templates';
import type { KycStatusChangedPayload } from '@penyzen/shared';
import { sendEmail } from '../ses/sesClient';

export async function processKycStatusChanged(payload: KycStatusChangedPayload): Promise<void> {
  const isApproved = payload.newStatus === 'APPROVED';

  const email = renderEmail(isApproved ? 'kyc-approved' : 'kyc-rejected', {
    subject: isApproved
      ? 'Your identity has been verified!'
      : 'Identity verification — action required',
    name: payload.userName,
    rejectionReason: payload.rejectionReason,
  });

  await sendEmail({
    to: payload.userEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
