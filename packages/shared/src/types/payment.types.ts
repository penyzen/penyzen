export type DonationStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type ConnectAccountStatus = 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED';

export interface DonationSummary {
  id: string;
  campaignId: string;
  campaignTitle: string;
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  status: DonationStatus;
  isAnonymous: boolean;
  message: string | null;
  donorName: string | null;
  createdAt: string;
}

export interface ConnectAccountSummary {
  accountId: string;
  status: ConnectAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresInformation: boolean;
}

export interface PaymentIntentResult {
  clientSecret: string;
  donationId: string;
  amountCents: number;
  feeCents: number;
}
