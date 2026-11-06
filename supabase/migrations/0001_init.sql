-- TapTab initial schema
-- Organizations (the paying customer) own one or more locations (restaurants).
-- Guests never touch the database directly: all guest reads/writes go through
-- server routes using the service role key. RLS below covers logged-in users.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type org_role       as enum ('owner','manager','staff');
create type org_status     as enum ('trial','active','past_due','canceled');
create type plan_tier      as enum ('essential','pro','business');
create type tag_status     as enum ('unassigned','assigned','disabled');
create type request_kind   as enum ('help','check','refill');
create type request_status as enum ('open','done');
create type event_type     as enum ('tap','menu','wifi','review','google','server','loyalty','instagram','website');
create type hw_status      as enum ('ordered','encoded','shipped','installed');

-- ---------- People ----------
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  phone             text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now()
);

create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  plan               plan_tier  not null default 'essential',
  status             org_status not null default 'trial',
  stripe_customer_id text unique,
  stripe_sub_id      text unique,
  created_at         timestamptz not null default now()
);

create table org_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ---------- Locations & hub ----------
create table locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  tagline     text,
  brand_color text not null default '#1F4D36',
  logo_url    text,
  timezone    text not null default 'America/Chicago',
  created_at  timestamptz not null default now()
);

create table hub_settings (
  location_id       uuid primary key references locations(id) on delete cascade,
  special           text,
  special_es        text,
  wifi_name         text,
  wifi_password     text,
  google_review_url text,
  instagram_url     text,
  website_url       text,
  languages         text[] not null default array['en','es'],
  buttons           jsonb  not null default
    '{"menu":true,"server":true,"wifi":true,"review":true,"loyalty":true,"instagram":true}',
  loyalty_goal      int    not null default 8 check (loyalty_goal between 3 and 20),
  loyalty_reward    text   not null default 'Your next main is on us',
  updated_at        timestamptz not null default now()
);

create table dining_tables (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  label       text not null,             -- "12", "Patio 3", "Bar"
  section     text,                      -- server section, e.g. "A"
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (location_id, label)
);

-- Staff who receive alerts. They don't need a login.
create table staff_contacts (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name        text not null,
  phone_e164  text not null,
  sections    text[] not null default '{}',   -- empty = all tables
  alerts_on   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Tags & hardware ----------
create table tag_batches (
  id         uuid primary key default gen_random_uuid(),
  quantity   int  not null check (quantity > 0),
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table tags (
  code         text primary key check (code ~ '^[A-Z0-9]{6,10}$'), -- written onto the chip: /t/CODE
  batch_id     uuid references tag_batches(id) on delete set null,
  location_id  uuid references locations(id) on delete set null,
  table_id     uuid references dining_tables(id) on delete set null,
  status       tag_status not null default 'unassigned',
  encoded_at   timestamptz,
  locked       boolean not null default false,
  last_tap_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (status <> 'assigned' or (location_id is not null and table_id is not null))
);
create index tags_location_idx on tags(location_id);

create table hardware_orders (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  stand_type  text not null default 'standard',   -- standard | custom | sticker
  quantity    int  not null check (quantity > 0),
  status      hw_status not null default 'ordered',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Menu ----------
create table menus (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name        text not null default 'Menu',
  pdf_url     text,                 -- optional uploaded PDF
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table menu_categories (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references menus(id) on delete cascade,
  name       jsonb not null,        -- {"en":"Starters","es":"Entradas"}
  sort_order int not null default 0
);

create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete cascade,
  name        jsonb not null,
  description jsonb not null default '{}',
  price_cents int  check (price_cents >= 0),
  tags        text[] not null default '{}',   -- veg, vegan, gf, hot
  photo_url   text,
  available   boolean not null default true,
  sort_order  int not null default 0
);

-- ---------- Guest activity ----------
create table events (
  id          bigint generated always as identity primary key,
  location_id uuid not null references locations(id) on delete cascade,
  table_id    uuid references dining_tables(id) on delete set null,
  tag_code    text references tags(code) on delete set null,
  type        event_type not null,
  session_id  text,
  created_at  timestamptz not null default now()
);
create index events_loc_time_idx on events(location_id, created_at desc);

create table service_requests (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  table_id    uuid references dining_tables(id) on delete set null,
  kind        request_kind not null,
  status      request_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
create index requests_open_idx on service_requests(location_id) where status = 'open';

create table guest_notes (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  table_id    uuid references dining_tables(id) on delete set null,
  stars       int check (stars between 1 and 5),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create table loyalty_cards (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  phone_e164    text not null,
  stamps        int  not null default 0 check (stamps >= 0),
  rewards_used  int  not null default 0,
  opted_in_at   timestamptz not null default now(),
  last_stamp_at timestamptz,
  unique (location_id, phone_e164)
);

-- Demo requests from the marketing site
create table leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  restaurant text,
  email      text,
  phone      text,
  tables     int,
  message    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

-- ---------- Helper functions for RLS ----------
create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$$;

create or replace function has_org_role(p_org uuid, p_roles org_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members
                 where org_id = p_org and user_id = auth.uid() and role = any(p_roles))
$$;

create or replace function location_org(p_location uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from locations where id = p_location
$$;

create or replace function can_read_location(p_location uuid) returns boolean
language sql stable as $$
  select is_platform_admin() or has_org_role(location_org(p_location), array['owner','manager','staff']::org_role[])
$$;

create or replace function can_edit_location(p_location uuid) returns boolean
language sql stable as $$
  select is_platform_admin() or has_org_role(location_org(p_location), array['owner','manager']::org_role[])
$$;

-- New auth user -> profile row
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- New location -> default hub settings + empty menu
create or replace function handle_new_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into hub_settings (location_id) values (new.id);
  insert into menus (location_id) values (new.id);
  return new;
end $$;
create trigger on_location_created after insert on locations
  for each row execute function handle_new_location();

-- ---------- Row level security ----------
alter table profiles         enable row level security;
alter table organizations    enable row level security;
alter table org_members      enable row level security;
alter table locations        enable row level security;
alter table hub_settings     enable row level security;
alter table dining_tables    enable row level security;
alter table staff_contacts   enable row level security;
alter table tag_batches      enable row level security;
alter table tags             enable row level security;
alter table hardware_orders  enable row level security;
alter table menus            enable row level security;
alter table menu_categories  enable row level security;
alter table menu_items       enable row level security;
alter table events           enable row level security;
alter table service_requests enable row level security;
alter table guest_notes      enable row level security;
alter table loyalty_cards    enable row level security;
alter table leads            enable row level security;

-- profiles: see and edit yourself; admins see all
create policy profiles_self   on profiles for select using (id = auth.uid() or is_platform_admin());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- users can edit their name/phone but never promote themselves to admin
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;

-- organizations
create policy orgs_read  on organizations for select using (is_platform_admin() or has_org_role(id, array['owner','manager','staff']::org_role[]));
create policy orgs_admin on organizations for all    using (is_platform_admin()) with check (is_platform_admin());
create policy orgs_owner_update on organizations for update using (has_org_role(id, array['owner']::org_role[]))
  with check (has_org_role(id, array['owner']::org_role[]));

-- org members
create policy members_read  on org_members for select using (is_platform_admin() or has_org_role(org_id, array['owner','manager','staff']::org_role[]));
create policy members_write on org_members for all using (is_platform_admin() or has_org_role(org_id, array['owner']::org_role[]))
  with check (is_platform_admin() or has_org_role(org_id, array['owner']::org_role[]));

-- locations
create policy loc_read   on locations for select using (can_read_location(id));
create policy loc_update on locations for update using (can_edit_location(id)) with check (can_edit_location(id));
create policy loc_insert on locations for insert with check (is_platform_admin() or has_org_role(org_id, array['owner']::org_role[]));
create policy loc_delete on locations for delete using (is_platform_admin());

-- location-scoped tables: read for members, write for owner/manager
do $$
declare t text;
begin
  foreach t in array array['hub_settings','dining_tables','staff_contacts','menus','hardware_orders'] loop
    execute format('create policy %1$s_read  on %1$s for select using (can_read_location(location_id))', t);
    execute format('create policy %1$s_write on %1$s for all using (can_edit_location(location_id)) with check (can_edit_location(location_id))', t);
  end loop;
end $$;
-- hardware orders: only admins change them (override write policy)
drop policy hardware_orders_write on hardware_orders;
create policy hardware_orders_admin on hardware_orders for all using (is_platform_admin()) with check (is_platform_admin());

create policy cat_read  on menu_categories for select using (can_read_location((select location_id from menus m where m.id = menu_id)));
create policy cat_write on menu_categories for all using (can_edit_location((select location_id from menus m where m.id = menu_id)))
  with check (can_edit_location((select location_id from menus m where m.id = menu_id)));
create policy item_read  on menu_items for select using (can_read_location((select m.location_id from menu_categories c join menus m on m.id = c.menu_id where c.id = category_id)));
create policy item_write on menu_items for all using (can_edit_location((select m.location_id from menu_categories c join menus m on m.id = c.menu_id where c.id = category_id)))
  with check (can_edit_location((select m.location_id from menu_categories c join menus m on m.id = c.menu_id where c.id = category_id)));

-- tags: restaurants can see their own tags and move them between their tables; admins manage all
create policy tags_read   on tags for select using (is_platform_admin() or (location_id is not null and can_read_location(location_id)));
create policy tags_admin  on tags for all using (is_platform_admin()) with check (is_platform_admin());
create policy tags_reassign on tags for update using (location_id is not null and can_edit_location(location_id))
  with check (location_id is not null and can_edit_location(location_id));
create policy batches_admin on tag_batches for all using (is_platform_admin()) with check (is_platform_admin());

-- guest activity: members read; staff can resolve requests; inserts only via service role
create policy events_read   on events           for select using (can_read_location(location_id));
create policy req_read      on service_requests for select using (can_read_location(location_id));
create policy req_resolve   on service_requests for update using (can_read_location(location_id)) with check (can_read_location(location_id));
create policy notes_read    on guest_notes      for select using (can_edit_location(location_id));
create policy loyalty_read  on loyalty_cards    for select using (can_edit_location(location_id));
create policy leads_admin   on leads            for all using (is_platform_admin()) with check (is_platform_admin());

-- Realtime: live request list on the dashboard
alter publication supabase_realtime add table service_requests;
