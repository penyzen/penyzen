// Types mirroring the backend's @penyzen/shared types.
// Kept in sync manually for now; consider extracting to a shared client package later.

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type CampaignCategory =
  | 'MEDICAL'
  | 'EDUCATION'
  | 'EMERGENCY'
  | 'NONPROFIT'
  | 'COMMUNITY'
  | 'CREATIVE'
  | 'OTHER';

export interface CampaignSummary {
  id: string;
  title: string;
  slug: string;
  story: string;
  category: CampaignCategory;
  status: CampaignStatus;
  goalAmountCents: number;
  raisedAmountCents: number;
  donorCount: number;
  coverImageUrl: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type UserRole = 'DONOR' | 'ORGANIZER' | 'ADMIN';
export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  kycStatus: KycStatus;
  avatarUrl: string | null;
  createdAt: string;
}
