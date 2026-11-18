-- AI review replies: Google reviews inbox, reply settings, Google Business Profile connection.

-- How a restaurant wants its replies to sound, and what may post without a human check.
create table if not exists review_settings (
  location_id uuid primary key references locations(id) on delete cascade,
  tone text not null default 'friendly' check (tone in ('friendly','warm','professional','fun')),
  sign_off text,                                  -- e.g. "– The Wok & Roll team"
  about text,                                     -- a few words the AI can use: "halal Asian-Desi food truck, Richmond Ave"
  auto_post_min_stars int not null default 4 check (auto_post_min_stars between 1 and 6), -- 6 = never auto-post
  updated_at timestamptz not null default now()
);

-- One row per review: Google reviews synced from the API, or ones an owner pasted in by hand.
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source text not null default 'google' check (source in ('google','manual')),
  google_name text unique,                        -- accounts/…/locations/…/reviews/… (Google reviews only)
  author text,
  stars int check (stars between 1 and 5),
  comment text,
  language text,
  reviewed_at timestamptz,
  draft text,                                     -- AI or owner-edited reply waiting to be posted
  draft_at timestamptz,
  reply text,                                     -- reply that is live on Google
  replied_at timestamptz,
  reply_by text check (reply_by in ('auto','owner','google')), -- 'google' = replied outside TapTab
  status text not null default 'new' check (status in ('new','drafted','needs_approval','posted','skipped','error')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_location_time on reviews (location_id, reviewed_at desc);

-- OAuth connection to the restaurant's Google Business Profile.
-- No RLS policies on purpose: only the server (service role) can read the token.
create table if not exists google_connections (
  location_id uuid primary key references locations(id) on delete cascade,
  google_email text,
  refresh_token text not null,
  account_name text,                              -- accounts/123
  location_name text,                             -- locations/456
  location_title text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

alter table review_settings enable row level security;
alter table reviews enable row level security;
alter table google_connections enable row level security;

create policy review_settings_read  on review_settings for select using (can_edit_location(location_id));
create policy review_settings_write on review_settings for all using (can_edit_location(location_id)) with check (can_edit_location(location_id));
create policy reviews_read   on reviews for select using (can_edit_location(location_id));
create policy reviews_write  on reviews for all using (can_edit_location(location_id)) with check (can_edit_location(location_id));
