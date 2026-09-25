-- ============================================================================
-- HUASCA HUB — Row Level Security
--
-- Regla general: un host solo puede leer/escribir SUS propias filas
-- (comparando hosts.user_id = auth.uid()). El público (sin login) puede leer
-- propiedades publicadas y su disponibilidad/precio, para que el buscador
-- funcione sin necesidad de cuenta.
--
-- bookings y payments NO se insertan directo desde el navegador: el flujo de
-- reserva pasa por una ruta de servidor (service role), que valida
-- disponibilidad y precio del lado del servidor antes de escribir. Por eso
-- aquí solo se abre lectura al host dueño, sin política de insert para el
-- público.
-- ============================================================================

alter table hosts enable row level security;
alter table amenities enable row level security;
alter table properties enable row level security;
alter table property_amenities enable row level security;
alter table property_photos enable row level security;
alter table pricing_rules enable row level security;
alter table rule_applications enable row level security;
alter table calendar_days enable row level security;
alter table ical_sources enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;

-- ----------------------------------------------------------------------------
-- hosts: cada quien ve y edita solo su propia fila de host.
-- ----------------------------------------------------------------------------
create policy "host_select_own" on hosts
  for select using (user_id = auth.uid());

create policy "host_update_own" on hosts
  for update using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- amenities: catálogo compartido, cualquiera (incluido público) lo puede leer.
-- Solo se edita manualmente (sin política de insert/update pública).
-- ----------------------------------------------------------------------------
create policy "amenities_select_all" on amenities
  for select using (true);

-- ----------------------------------------------------------------------------
-- properties: público ve solo las publicadas; el host ve y edita TODAS las
-- suyas (incluidas borradores).
-- ----------------------------------------------------------------------------
create policy "properties_select_published" on properties
  for select using (status = 'published');

create policy "properties_select_own" on properties
  for select using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

create policy "properties_insert_own" on properties
  for insert with check (
    host_id in (select id from hosts where user_id = auth.uid())
  );

create policy "properties_update_own" on properties
  for update using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

create policy "properties_delete_own" on properties
  for delete using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- property_amenities / property_photos: visibles si la propiedad es pública
-- o si el visitante es el host dueño; escritura solo el host dueño.
-- ----------------------------------------------------------------------------
create policy "property_amenities_select" on property_amenities
  for select using (
    property_id in (
      select id from properties
      where status = 'published'
         or host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "property_amenities_write_own" on property_amenities
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "property_photos_select" on property_photos
  for select using (
    property_id in (
      select id from properties
      where status = 'published'
         or host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "property_photos_write_own" on property_photos
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- pricing_rules / rule_applications: privado, solo el host dueño (contienen
-- estrategia de precios, no debe ser público).
-- ----------------------------------------------------------------------------
create policy "pricing_rules_all_own" on pricing_rules
  for all using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

create policy "rule_applications_all_own" on rule_applications
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- calendar_days: el PÚBLICO necesita leer esto (precio y disponibilidad por
-- día) para que el buscador funcione sin login. Solo lectura de propiedades
-- publicadas; escritura solo el host dueño (o el proceso de servidor que
-- recalcula, que usa la service role key y se salta RLS).
-- ----------------------------------------------------------------------------
create policy "calendar_days_select_published" on calendar_days
  for select using (
    property_id in (select id from properties where status = 'published')
  );

create policy "calendar_days_select_own" on calendar_days
  for select using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "calendar_days_write_own" on calendar_days
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- ical_sources: privado, solo el host dueño (contiene URLs de sus canales).
-- ----------------------------------------------------------------------------
create policy "ical_sources_all_own" on ical_sources
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- bookings / payments: solo lectura para el host dueño de la propiedad.
-- La escritura (crear una reserva) pasa por una ruta de servidor con la
-- service role key, que valida todo del lado del servidor antes de insertar
-- — nunca directo desde el navegador del huésped.
-- ----------------------------------------------------------------------------
create policy "bookings_select_own" on bookings
  for select using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "payments_select_own" on payments
  for select using (
    booking_id in (
      select b.id from bookings b
      join properties p on p.id = b.property_id
      where p.host_id in (select id from hosts where user_id = auth.uid())
    )
  );
