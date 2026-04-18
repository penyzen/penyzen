export const CAMPAIGN_CATEGORIES = [
  'MEDICAL',
  'EDUCATION',
  'EMERGENCY',
  'NONPROFIT',
  'COMMUNITY',
  'CREATIVE',
  'OTHER',
] as const;

export const MAX_CAMPAIGN_TITLE_LENGTH = 100;
export const MAX_CAMPAIGN_DESCRIPTION_LENGTH = 500;
export const MIN_GOAL_AMOUNT_CENTS = 100_00;   // $100 minimum goal
export const MAX_GOAL_AMOUNT_CENTS = 10_000_000_00; // $10M maximum goal
export const MAX_MILESTONES_PER_CAMPAIGN = 10;
export const MAX_MEDIA_UPLOADS_PER_CAMPAIGN = 10;
export const MEDIA_PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
