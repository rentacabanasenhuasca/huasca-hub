-- ============================================================================
-- hero_media: fotos y/o video que se muestran como portada (hero) de la
-- página de inicio, en un carrusel que avanza solo. El host los administra
-- desde /admin/portada — antes la portada era un fondo fijo sin imágenes.
-- ============================================================================

create table hero_media (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_hero_media_host on hero_media(host_id, sort_order);

alter table hero_media enable row level security;

-- Público: la página de inicio la lee sin sesión — solo lo que está activo.
create policy "hero_media_select_public" on hero_media
  for select using (enabled = true);

-- Host: ve también lo que tiene pausado, para poder administrarlo.
create policy "hero_media_select_own" on hero_media
  for select using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

create policy "hero_media_write_own" on hero_media
  for all using (
    host_id in (select id from hosts where user_id = auth.uid())
  ) with check (
    host_id in (select id from hosts where user_id = auth.uid())
  );

grant all on hero_media to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Storage: bucket público para las fotos/video de portada, igual que
-- property-photos. Se limita el tamaño (video puede pesar bastante) y los
-- tipos de archivo aceptados.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  209715200, -- 200 MB, para dar margen a un video corto
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "site_media_read_public" on storage.objects
  for select using (bucket_id = 'site-media');

create policy "site_media_insert_authenticated" on storage.objects
  for insert with check (bucket_id = 'site-media' and auth.role() = 'authenticated');

create policy "site_media_delete_authenticated" on storage.objects
  for delete using (bucket_id = 'site-media' and auth.role() = 'authenticated');
