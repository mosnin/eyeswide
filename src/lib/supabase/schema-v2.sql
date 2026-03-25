-- EyesWide Schema V2 - Additional tables for Brandz-inspired features
-- Run AFTER schema.sql

-- ============================================================
-- OPPORTUNITIES (brands post open opportunities for all creators)
-- ============================================================
create table public.opportunities (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brand_profiles(id) on delete cascade not null,
  title text not null,
  description text not null,
  requirements text,
  niches text[] not null default '{}',
  compensation_type text not null default 'product_only' check (compensation_type in ('product_only', 'product_and_payment', 'payment_only')),
  compensation_details text,
  deadline timestamptz,
  max_creators integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- OPPORTUNITY APPLICATIONS (creators apply to open opportunities)
-- ============================================================
create table public.opportunity_applications (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid references public.opportunities(id) on delete cascade not null,
  creator_id uuid references public.creator_profiles(id) on delete cascade not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, creator_id)
);

-- ============================================================
-- FAVORITES (creators save brands, brands save creators)
-- ============================================================
create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('creator', 'brand')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);

-- ============================================================
-- OUTREACH TEMPLATES (reusable message templates)
-- ============================================================
create table public.outreach_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS (post-campaign reviews from both sides)
-- ============================================================
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(campaign_id, reviewer_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_opportunities_brand_id on public.opportunities(brand_id);
create index idx_opportunities_active on public.opportunities(is_active);
create index idx_opportunity_apps_opp_id on public.opportunity_applications(opportunity_id);
create index idx_opportunity_apps_creator_id on public.opportunity_applications(creator_id);
create index idx_favorites_user_id on public.favorites(user_id);
create index idx_outreach_templates_user_id on public.outreach_templates(user_id);
create index idx_reviews_campaign_id on public.reviews(campaign_id);
create index idx_reviews_reviewee_id on public.reviews(reviewee_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Opportunities: viewable by all authenticated users
alter table public.opportunities enable row level security;

create policy "Opportunities viewable by authenticated users"
  on public.opportunities for select
  to authenticated
  using (true);

create policy "Brands can manage own opportunities"
  on public.opportunities for all
  using (
    exists (
      select 1 from public.brand_profiles
      where id = opportunities.brand_id and user_id = auth.uid()
    )
  );

-- Opportunity applications
alter table public.opportunity_applications enable row level security;

create policy "Creators can view own applications"
  on public.opportunity_applications for select
  to authenticated
  using (
    exists (
      select 1 from public.creator_profiles
      where id = opportunity_applications.creator_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.opportunities o
      join public.brand_profiles bp on bp.id = o.brand_id
      where o.id = opportunity_applications.opportunity_id and bp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles where id = auth.uid() and account_type = 'admin'
    )
  );

create policy "Creators can apply to opportunities"
  on public.opportunity_applications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.creator_profiles
      where id = opportunity_applications.creator_id and user_id = auth.uid()
    )
  );

-- Favorites: users manage their own
alter table public.favorites enable row level security;

create policy "Users can manage own favorites"
  on public.favorites for all
  using (auth.uid() = user_id);

-- Outreach templates: users manage their own
alter table public.outreach_templates enable row level security;

create policy "Users can manage own templates"
  on public.outreach_templates for all
  using (auth.uid() = user_id);

-- Reviews: viewable by all authenticated, writable by campaign participants
alter table public.reviews enable row level security;

create policy "Reviews viewable by authenticated users"
  on public.reviews for select
  to authenticated
  using (true);

create policy "Campaign participants can write reviews"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = reviewer_id);

-- Updated_at triggers for new tables
create trigger set_updated_at before update on public.opportunities
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.opportunity_applications
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.outreach_templates
  for each row execute procedure public.handle_updated_at();
