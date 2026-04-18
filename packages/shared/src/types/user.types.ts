export type UserRole = 'DONOR' | 'ORGANIZER' | 'ADMIN';
export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrgMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isVerified: boolean;
}

export interface OrgMember {
  userId: string;
  name: string;
  email: string;
  role: OrgMemberRole;
  joinedAt: string;
}

/** The JWT claims injected by API Gateway after Cognito verification */
export interface CognitoClaims {
  sub: string;        // Cognito user ID (cognitoId in DB)
  email: string;
  email_verified: string;
  'cognito:username': string;
}
