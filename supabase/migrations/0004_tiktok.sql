-- TikTok link on the guest hub
alter table hub_settings add column if not exists tiktok_url text;
alter type event_type add value if not exists 'tiktok';
alter table hub_settings alter column buttons set default
  '{"menu":true,"server":true,"wifi":true,"review":true,"loyalty":true,"instagram":true,"tiktok":true}';
update hub_settings set buttons = buttons || '{"tiktok": true}'::jsonb where not (buttons ? 'tiktok');
