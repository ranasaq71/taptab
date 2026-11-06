-- Public bucket for menu item photos and full-menu PDFs (uploaded through the server, max 4 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-media', 'menu-media', true, 4194304, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
