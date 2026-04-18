export type NotificationEventType =
  | 'DONATION_RECEIVED'
  | 'CAMPAIGN_CREATED'
  | 'KYC_STATUS_CHANGED'
  | 'CAMPAIGN_UPDATE_POSTED'
  | 'WELCOME_USER';

export interface DonationReceivedPayload {
  donationId: string;
  campaignId: string;
  campaignTitle: string;
  amountCents: number;
  donorName: string | null;
  donorEmail: string;
  isAnonymous: boolean;
  message: string | null;
  organizerEmail: string;
  organizerName: string;
}

export interface CampaignCreatedPayload {
  campaignId: string;
  campaignTitle: string;
  organizerEmail: string;
  organizerName: string;
}

export interface KycStatusChangedPayload {
  userId: string;
  userEmail: string;
  userName: string;
  newStatus: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface CampaignUpdatePostedPayload {
  campaignId: string;
  campaignTitle: string;
  updateTitle: string;
  updateBody: string;
  donorEmails: string[];
}

export interface WelcomeUserPayload {
  userId: string;
  userEmail: string;
  userName: string;
}

export type NotificationEvent =
  | { type: 'DONATION_RECEIVED'; payload: DonationReceivedPayload }
  | { type: 'CAMPAIGN_CREATED'; payload: CampaignCreatedPayload }
  | { type: 'KYC_STATUS_CHANGED'; payload: KycStatusChangedPayload }
  | { type: 'CAMPAIGN_UPDATE_POSTED'; payload: CampaignUpdatePostedPayload }
  | { type: 'WELCOME_USER'; payload: WelcomeUserPayload };
