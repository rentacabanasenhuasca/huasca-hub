-- ============================================================================
-- Sincronización iCal: importar calendarios externos (Airbnb, Booking,
-- Titanshub, o cualquier otro) y exportar el propio, cantidad ilimitada por
-- propiedad — igual que el "Imp./Exp. de iCal" de WP Booking System.
-- ============================================================================

-- Nombre visible del calendario (ej. "Airbnb", "Titanshub"), además del
-- "platform" que ya existía (solo para el ícono/color).
alter table ical_sources
  add column label text;

update ical_sources set label = initcap(platform) where label is null;
alter table ical_sources alter column label set not null;

-- ----------------------------------------------------------------------------
-- blocked_dates: días bloqueados por un calendario externo (o, más adelante,
-- por una reserva propia confirmada). Es la fuente de verdad de
-- disponibilidad — separada de calendar_days, que solo resuelve PRECIO.
-- Un día puede aparecer una sola vez por propiedad; si dos fuentes bloquean
-- el mismo día, solo se guarda una fila (no importa cuál, con que exista ya
-- está bloqueado).
-- ----------------------------------------------------------------------------
create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  date date not null,
  source text not null check (source in ('ical', 'booking')),
  ical_source_id uuid references ical_sources(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (property_id, date)
);

create index idx_blocked_dates_property_date on blocked_dates(property_id, date);
create index idx_blocked_dates_ical_source on blocked_dates(ical_source_id);

alter table blocked_dates enable row level security;

-- Público: necesita leer esto para saber qué fechas NO ofrecer en el
-- buscador (igual que calendar_days).
create policy "blocked_dates_select_published" on blocked_dates
  for select using (
    property_id in (select id from properties where status = 'published')
  );

create policy "blocked_dates_select_own" on blocked_dates
  for select using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

create policy "blocked_dates_write_own" on blocked_dates
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on blocked_dates to anon, authenticated, service_role;
