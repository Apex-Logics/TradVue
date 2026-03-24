-- Verified performance badges registry
-- Apply manually in Supabase SQL editor

create table if not exists verified_badges (
  id uuid primary key,
  user_id uuid not null,
  verify_hash text not null unique,
  template text not null default 'dark',
  period_key text not null,
  payload jsonb not null,
  signature text not null,
  image_svg text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_verified_badges_user_id on verified_badges(user_id);
create index if not exists idx_verified_badges_verify_hash on verified_badges(verify_hash);
