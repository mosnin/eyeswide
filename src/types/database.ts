export type AccountType = "creator" | "brand" | "admin";

export type OnboardingStatus = "pending" | "in_progress" | "completed";

export type CampaignStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "paused"
  | "expired";

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "facebook"
  | "pinterest"
  | "snapchat"
  | "linkedin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  account_type: AccountType;
  onboarding_status: OnboardingStatus;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  niche: string[];
  location: string | null;
  website: string | null;
  portfolio_url: string | null;
  avatar_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: string;
  creator_id: string;
  platform: SocialPlatform;
  username: string;
  profile_url: string;
  follower_count: number | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandProfile {
  id: string;
  user_id: string;
  company_name: string;
  industry: string;
  company_size: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  contact_email: string;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  brand_id: string;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  plan: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  creator_id: string;
  title: string;
  description: string;
  requirements: string;
  deliverables: string[];
  compensation_type: "product_only" | "product_and_payment" | "payment_only";
  compensation_details: string | null;
  deadline: string | null;
  status: CampaignStatus;
  brand_notes: string | null;
  creator_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  campaign_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminRecord {
  id: string;
  actor_id: string;
  target_type: string;
  target_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}
