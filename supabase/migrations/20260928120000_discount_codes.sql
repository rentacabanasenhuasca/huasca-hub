-- ============================================================================
-- Códigos de descuento / cupones promocionales.
--
-- discount_codes: el catálogo del host. Un código puede ser % o monto fijo
-- MXN, con vigencia por fechas (comparada contra la fecha de check-in de la
-- reserva, no contra "hoy" — así "20% en septiembre" se puede vender con
-- anticipación y sigue aplicando el día del check-in), un mínimo de noches,
-- un límite de usos totales, y restringirse a unidades específicas (mismo
-- patrón que addons/addon_properties: sin filas en discount_code_properties
-- = aplica a todas las cabañas del host).
--
-- El descuento se vuelve a validar y calcular SIEMPRE en el servidor al
-- cobrar (nunca se confía en un monto que mande el navegador), igual que ya
-- hace getBookingQuote() con el precio y resolveAddons() con los extras.
-- ============================================================================

create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,

  code text not null,
  description text,

  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),

  -- Vigencia por fecha de check-in de la reserva. NULL = sin límite en ese
  -- extremo (ej. solo valid_until = "válido hasta el 31 de octubre", sin
  -- importar cuándo se reserve).
  valid_from date,
  valid_until date,

  min_nights int, -- NULL = sin mínimo adicional al de la propiedad

  max_uses int, -- NULL = usos ilimitados
  times_used int not null default 0,

  active boolean not null default true,

  created_at timestamptz not null default now(),

  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

-- Un mismo código (case-insensitive) no se repite dentro del mismo host.
create unique index idx_discount_codes_host_code on discount_codes (host_id, upper(code));
create index idx_discount_codes_host on discount_codes(host_id);

alter table discount_codes enable row level security;

-- El checkout público necesita poder leer códigos activos para validarlos
-- (misma idea que "addons_select_active"), pero solo el host administra los
-- suyos.
create policy "discount_codes_select_active" on discount_codes
  for select using (active = true);

create policy "discount_codes_all_own" on discount_codes
  for all using (
    host_id in (select id from hosts where user_id = auth.uid())
  );

grant all on discount_codes to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- discount_code_properties: unidades donde aplica cada código (vacío para
-- un código = aplica a todas las cabañas del host).
-- ----------------------------------------------------------------------------
create table discount_code_properties (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references discount_codes(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  unique (discount_code_id, property_id)
);

create index idx_discount_code_properties_code on discount_code_properties(discount_code_id);

alter table discount_code_properties enable row level security;

create policy "discount_code_properties_select_all" on discount_code_properties
  for select using (true);

create policy "discount_code_properties_all_own" on discount_code_properties
  for all using (
    discount_code_id in (
      select id from discount_codes where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on discount_code_properties to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- bookings: registro de qué código se usó y cuánto se descontó, como "foto"
-- del momento (igual criterio que booking_addons) — si el host luego borra
-- o cambia el cupón, la reserva ya hecha no cambia de total.
-- ----------------------------------------------------------------------------
alter table bookings add column discount_code_id uuid references discount_codes(id) on delete set null;
alter table bookings add column discount_code text;
alter table bookings add column discount_amount_mxn numeric(10,2) not null default 0;
