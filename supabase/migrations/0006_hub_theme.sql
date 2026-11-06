-- Restaurant chooses the guest hub layout: light or dark
alter table hub_settings add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
