import { renderEmail } from '@penyzen/email-templates';
import type { CampaignCreatedPayload } from '@penyzen/shared';
import { sendEmail } from '../ses/sesClient';

export async function processCampaignCreated(payload: CampaignCreatedPayload): Promise<void> {
  const email = renderEmail('campaign-created', {
    subject: `Your campaign "${payload.campaignTitle}" is live!`,
    organizerName: payload.organizerName,
    campaignTitle: payload.campaignTitle,
    campaignSlug: payload.campaignId,
  });

  await sendEmail({
    to: payload.organizerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
