import { renderEmail } from '@penyzen/email-templates';
import type { DonationReceivedPayload } from '@penyzen/shared';
import { sendEmail } from '../ses/sesClient';

export async function processDonationReceived(payload: DonationReceivedPayload): Promise<void> {
  const amountDollars = (payload.amountCents / 100).toFixed(2);
  const netAmountDollars = ((payload.amountCents * 0.975) / 100).toFixed(2); // approx after 2.5% fee

  // 1. Email to donor
  const donorEmail = renderEmail('donation-received-donor', {
    subject: `Your $${amountDollars} donation was successful!`,
    donorName: payload.donorName ?? 'Donor',
    campaignTitle: payload.campaignTitle,
    amountDollars,
    message: payload.message,
    donationId: payload.donationId,
    campaignSlug: payload.campaignId, // In production, pass slug from the service
  });

  await sendEmail({
    to: payload.donorEmail,
    subject: donorEmail.subject,
    html: donorEmail.html,
    text: donorEmail.text,
  });

  // 2. Email to organizer
  const organizerEmail = renderEmail('donation-received-organizer', {
    subject: `You received a $${amountDollars} donation!`,
    organizerName: payload.organizerName,
    campaignTitle: payload.campaignTitle,
    amountDollars,
    netAmountDollars,
    donorName: payload.donorName,
    isAnonymous: payload.isAnonymous,
    message: payload.message,
    campaignId: payload.campaignId,
  });

  await sendEmail({
    to: payload.organizerEmail,
    subject: organizerEmail.subject,
    html: organizerEmail.html,
    text: organizerEmail.text,
  });
}
