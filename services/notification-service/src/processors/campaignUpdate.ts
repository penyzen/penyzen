import { renderEmail } from '@penyzen/email-templates';
import type { CampaignUpdatePostedPayload } from '@penyzen/shared';
import { sendEmail } from '../ses/sesClient';

export async function processCampaignUpdate(payload: CampaignUpdatePostedPayload): Promise<void> {
  if (payload.donorEmails.length === 0) return;

  const email = renderEmail('campaign-update', {
    subject: `Update from "${payload.campaignTitle}": ${payload.updateTitle}`,
    campaignTitle: payload.campaignTitle,
    campaignSlug: payload.campaignId,
    updateTitle: payload.updateTitle,
    updateBody: payload.updateBody,
  });

  // Send to all donors in one SES call (chunked automatically by sesClient)
  await sendEmail({
    to: payload.donorEmails,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
