-- ============================================================================
-- Vista de ocupación en el calendario: abrir/bloquear espacios manualmente
-- (independiente de iCal) y fijar noches mínimas por fecha directamente,
-- igual que el panel lateral de Airbnb (Disponibilidad / Noches mínimas).
-- ============================================================================

-- Permite bloqueos manuales del host, además de 'ical' y 'booking'.
alter table blocked_dates drop constraint blocked_dates_source_check;
alter table blocked_dates add constraint blocked_dates_source_check
  check (source in ('ical', 'booking', 'manual'));

-- ----------------------------------------------------------------------------
-- min_nights_overrides: noches mínimas fijadas a mano por el host para una
-- fecha específica, con prioridad absoluta sobre el mínimo de la propiedad y
-- sobre cualquier regla de precio aplicada a ese día (misma idea que
-- "Noches mínimas" en el panel de fechas de Airbnb).
-- ----------------------------------------------------------------------------
create table min_nights_overrides (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  date date not null,
  min_nights integer not null check (min_nights >= 1),
  created_at timestamptz not null default now(),
  unique (property_id, date)
);

create index idx_min_nights_overrides_property_date on min_nights_overrides(property_id, date);

alter table min_nights_overrides enable row level security;

create policy "min_nights_overrides_select_published" on min_nights_overrides
  for select using (
    property_id in (select id from properties where status = 'published')
  );

create policy "min_nights_overrides_select_own" on min_nights_overrides
  for select using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "min_nights_overrides_write_own" on min_nights_overrides
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on min_nights_overrides to anon, authenticated, service_role;
