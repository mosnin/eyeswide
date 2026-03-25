-- EyesWide Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  account_type text not null check (account_type in ('creator', 'brand', 'admin')),
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'in_progress', 'completed')),
  onboarding_step integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CREATOR PROFILES
-- ============================================================
create table public.creator_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  display_name text not null default '',
  bio text,
  niche text[] not null default '{}',
  location text,
  website text,
  portfolio_url text,
  avatar_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SOCIAL ACCOUNTS (linked to creator profiles)
-- ============================================================
create table public.social_accounts (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references public.creator_profiles(id) on delete cascade not null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'pinterest', 'snapchat', 'linkedin')),
  username text not null,
  profile_url text not null,
  follower_count integer,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(creator_id, platform)
);

-- ============================================================
-- BRAND PROFILES
-- ============================================================
create table public.brand_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  company_name text not null default '',
  industry text not null default '',
  company_size text,
  website text,
  logo_url text,
  description text,
  contact_email text not null default '',
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SUBSCRIPTIONS (for brands)
-- ============================================================
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brand_profiles(id) on delete cascade not null unique,
  ls_customer_id text,
  ls_subscription_id text,
  plan text not null default 'free',
  status text not null default 'trialing' check (status in ('active', 'trialing', 'past_due', 'cancelled', 'paused', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CAMPAIGNS (brand reaches out to creator)
-- ============================================================
create table public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brand_profiles(id) on delete cascade not null,
  creator_id uuid references public.creator_profiles(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  requirements text not null default '',
  deliverables text[] not null default '{}',
  compensation_type text not null default 'product_only' check (compensation_type in ('product_only', 'product_and_payment', 'payment_only')),
  compensation_details text,
  deadline timestamptz,
  status text not null default 'pending' check (status in ('draft', 'pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled')),
  brand_notes text,
  creator_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MESSAGES (within a campaign)
-- ============================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ADMIN RECORDS (audit trail)
-- ============================================================
create table public.admin_records (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id) not null,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_profiles_account_type on public.profiles(account_type);
create index idx_creator_profiles_user_id on public.creator_profiles(user_id);
create index idx_social_accounts_creator_id on public.social_accounts(creator_id);
create index idx_brand_profiles_user_id on public.brand_profiles(user_id);
create index idx_campaigns_brand_id on public.campaigns(brand_id);
create index idx_campaigns_creator_id on public.campaigns(creator_id);
create index idx_campaigns_status on public.campaigns(status);
create index idx_messages_campaign_id on public.messages(campaign_id);
create index idx_messages_sender_id on public.messages(sender_id);
create index idx_admin_records_actor_id on public.admin_records(actor_id);
create index idx_admin_records_target on public.admin_records(target_type, target_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can read all profiles but only update their own
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Creator profiles: viewable by all authenticated users, editable by owner
alter table public.creator_profiles enable row level security;

create policy "Creator profiles are viewable by authenticated users"
  on public.creator_profiles for select
  to authenticated
  using (true);

create policy "Creators can update own profile"
  on public.creator_profiles for update
  using (auth.uid() = user_id);

create policy "Creators can insert own profile"
  on public.creator_profiles for insert
  with check (auth.uid() = user_id);

-- Social accounts: viewable by all authenticated, editable by creator owner
alter table public.social_accounts enable row level security;

create policy "Social accounts viewable by authenticated users"
  on public.social_accounts for select
  to authenticated
  using (true);

create policy "Creators can manage own social accounts"
  on public.social_accounts for all
  using (
    exists (
      select 1 from public.creator_profiles
      where id = social_accounts.creator_id
      and user_id = auth.uid()
    )
  );

-- Brand profiles: viewable by all authenticated, editable by owner
alter table public.brand_profiles enable row level security;

create policy "Brand profiles viewable by authenticated users"
  on public.brand_profiles for select
  to authenticated
  using (true);

create policy "Brands can update own profile"
  on public.brand_profiles for update
  using (auth.uid() = user_id);

create policy "Brands can insert own profile"
  on public.brand_profiles for insert
  with check (auth.uid() = user_id);

-- Subscriptions: viewable by brand owner only
alter table public.subscriptions enable row level security;

create policy "Brands can view own subscription"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.brand_profiles
      where id = subscriptions.brand_id
      and user_id = auth.uid()
    )
  );

-- Campaigns: viewable by participating brand and creator
alter table public.campaigns enable row level security;

create policy "Participants can view campaigns"
  on public.campaigns for select
  to authenticated
  using (
    exists (
      select 1 from public.brand_profiles where id = campaigns.brand_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.creator_profiles where id = campaigns.creator_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles where id = auth.uid() and account_type = 'admin'
    )
  );

create policy "Brands can create campaigns"
  on public.campaigns for insert
  with check (
    exists (
      select 1 from public.brand_profiles where id = campaigns.brand_id and user_id = auth.uid()
    )
  );

create policy "Participants can update campaigns"
  on public.campaigns for update
  using (
    exists (
      select 1 from public.brand_profiles where id = campaigns.brand_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.creator_profiles where id = campaigns.creator_id and user_id = auth.uid()
    )
  );

-- Messages: viewable by campaign participants
alter table public.messages enable row level security;

create policy "Campaign participants can view messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = messages.campaign_id
      and (
        exists (select 1 from public.brand_profiles where id = c.brand_id and user_id = auth.uid())
        or exists (select 1 from public.creator_profiles where id = c.creator_id and user_id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and account_type = 'admin')
      )
    )
  );

create policy "Authenticated users can send messages"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Admin records: viewable by admins only
alter table public.admin_records enable row level security;

create policy "Admins can view admin records"
  on public.admin_records for select
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and account_type = 'admin'
    )
  );

create policy "Admins can insert admin records"
  on public.admin_records for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and account_type = 'admin'
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'account_type', 'creator')
  );
  return new;
end;
$$;

-- Trigger to auto-create profile
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.creator_profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.social_accounts
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.brand_profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.campaigns
  for each row execute procedure public.handle_updated_at();
