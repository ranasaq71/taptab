-- Dish options (modifier groups) and admin-granted free months.

-- [{ "name": {"en": "Wing Flavor"}, "required": true, "min": 1, "max": 1,
--    "options": [{ "name": {"en": "Hot"}, "priceCents": 0 }, ...] }, ...]
alter table menu_items add column if not exists modifiers jsonb not null default '[]'
  check (jsonb_typeof(modifiers) = 'array');

-- When set and in the future, the restaurant is on a free period granted by a TapTab admin.
alter table organizations add column if not exists free_until timestamptz;
alter table organizations add column if not exists free_note text;

-- Owners may rename their organization, but billing fields stay under TapTab's control.
create or replace function guard_org_billing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not is_platform_admin() then
    new.plan := old.plan;
    new.status := old.status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_sub_id := old.stripe_sub_id;
    new.free_until := old.free_until;
    new.free_note := old.free_note;
  end if;
  return new;
end $$;
drop trigger if exists org_billing_guard on organizations;
create trigger org_billing_guard before update on organizations
  for each row execute function guard_org_billing();
