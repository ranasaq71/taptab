-- Public bucket for restaurant logos (uploaded through the server, max 2 MB).
-- SVG is excluded because SVG files can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
