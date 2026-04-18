export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type CampaignCategory =
  | 'MEDICAL'
  | 'EDUCATION'
  | 'EMERGENCY'
  | 'NONPROFIT'
  | 'COMMUNITY'
  | 'CREATIVE'
  | 'OTHER';

export type MilestoneStatus = 'PENDING' | 'REACHED' | 'DISBURSED';

export interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: CampaignCategory;
  status: CampaignStatus;
  goalAmountCents: number;
  raisedAmountCents: number;
  donorCount: number;
  coverImageUrl: string | null;
  location: string | null;
  endsAt: string | null;
  organizerName: string;
  organizationName: string | null;
  createdAt: string;
}

export interface CampaignDetail extends CampaignSummary {
  videoUrl: string | null;
  milestones: MilestoneSummary[];
  recentUpdates: CampaignUpdateSummary[];
}

export interface MilestoneSummary {
  id: string;
  title: string;
  description: string | null;
  targetAmountCents: number;
  status: MilestoneStatus;
  reachedAt: string | null;
}

export interface CampaignUpdateSummary {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}
