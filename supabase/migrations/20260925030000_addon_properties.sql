-- ============================================================================
-- Restringir en qué cabañas aplica cada extra. Por defecto (sin filas en
-- esta tabla para un addon) el extra se ofrece en TODAS las propiedades del
-- host, igual que antes — solo si el host elige unidades específicas al
-- crear/editar el extra se limita a esas.
-- ============================================================================

create table addon_properties (
  addon_id uuid not null references addons(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  primary key (addon_id, property_id)
);

create index idx_addon_properties_property on addon_properties(property_id);

alter table addon_properties enable row level security;

-- Público: el checkout necesita saber a qué propiedades aplica cada extra
-- activo para filtrar la lista que se le muestra al huésped.
create policy "addon_properties_select_public" on addon_properties
  for select using (
    addon_id in (select id from addons where active = true)
  );

create policy "addon_properties_all_own" on addon_properties
  for all using (
    addon_id in (
      select id from addons
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on addon_properties to anon, authenticated, service_role;
