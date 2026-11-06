-- Menu redesign: section subtitles, list or card layout per section, dish heat level (0-3 flames)
alter table menu_categories add column if not exists subtitle jsonb not null default '{}';
alter table menu_categories add column if not exists display text not null default 'list' check (display in ('list', 'cards'));
alter table menu_items add column if not exists heat smallint not null default 0 check (heat between 0 and 3);
-- Dishes already labelled spicy start at one flame
update menu_items set heat = 1 where heat = 0 and 'hot' = any(tags);
