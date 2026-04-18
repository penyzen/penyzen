import { logger } from '@penyzen/shared';
import type { NotificationEvent } from '@penyzen/shared';
import { processDonationReceived } from './donationReceived';
import { processCampaignCreated } from './campaignCreated';
import { processKycStatusChanged } from './kycStatusChanged';
import { processCampaignUpdate } from './campaignUpdate';
import { processWelcomeUser } from './welcomeUser';

export async function processEvent(event: NotificationEvent): Promise<void> {
  logger.info({ type: event.type }, 'processing notification event');

  switch (event.type) {
    case 'DONATION_RECEIVED':
      await processDonationReceived(event.payload);
      break;
    case 'CAMPAIGN_CREATED':
      await processCampaignCreated(event.payload);
      break;
    case 'KYC_STATUS_CHANGED':
      await processKycStatusChanged(event.payload);
      break;
    case 'CAMPAIGN_UPDATE_POSTED':
      await processCampaignUpdate(event.payload);
      break;
    case 'WELCOME_USER':
      await processWelcomeUser(event.payload);
      break;
    default:
      logger.warn({ event }, 'unknown notification event type');
  }
}
