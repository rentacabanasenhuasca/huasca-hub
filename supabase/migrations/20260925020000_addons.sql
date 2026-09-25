-- ============================================================================
-- Extras / add-ons opcionales en el checkout (early check-in, jacuzzi, kits,
-- actividades…), igual que en wandercabins.mx: el huésped los agrega antes
-- de pagar y se suman al total.
--
-- addons: catálogo del host (no por propiedad — se ofrecen igual en todas
-- sus cabañas, como pidió Christian). unit='flat' = una sola vez (casilla
-- "Agregar"/"Quitar"), unit='per_unit' = cantidad ajustable hasta
-- max_quantity (precio × cantidad). El precio real SIEMPRE se vuelve a leer
-- de esta tabla al cobrar — nunca se confía en lo que mande el navegador
-- (mismo criterio que ya usa getBookingQuote() para el precio de la
-- estancia).
--
-- booking_addons: lo que efectivamente se cobró en cada reserva, guardado
-- como "foto" (nombre/precio/cantidad) en vez de solo apuntar al addon — así
-- si el host luego cambia el precio o borra el extra, las reservas viejas no
-- cambian de total.
-- ============================================================================

create table addons (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  description text,
  price_mxn numeric(10,2) not null check (price_mxn >= 0),
  unit text not null default 'flat' check (unit in ('flat', 'per_unit')),
  max_quantity integer not null default 1 check (max_quantity >= 1),
  photo_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_addons_host on addons(host_id);

alter table addons enable row level security;

create policy "addons_select_active" on addons
  for select using (active = true);

create policy "addons_all_own" on addons
  for all using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

grant all on addons to anon, authenticated, service_role;

create table booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  addon_id uuid references addons(id) on delete set null,
  name text not null,
  unit_price_mxn numeric(10,2) not null,
  quantity integer not null check (quantity >= 1),
  subtotal_mxn numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index idx_booking_addons_booking on booking_addons(booking_id);

alter table booking_addons enable row level security;

create policy "booking_addons_select_own" on booking_addons
  for select using (
    booking_id in (
      select b.id from bookings b
      join properties p on p.id = b.property_id
      where p.host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on booking_addons to anon, authenticated, service_role;
