-- ============================================================================
-- HUASCA HUB — esquema base
-- Fase 1: single-tenant (solo Huasca Retreats), preparado para multi-tenant.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- hosts: cada anfitrión. Por ahora solo existirá una fila (Christian / Huasca
-- Retreats), pero la estructura ya soporta agregar más hosts después sin
-- tocar el resto del esquema.
-- ----------------------------------------------------------------------------
create table hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  stripe_account_id text,
  mercadopago_account_id text,
  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'verified')),
  commission_rate numeric(5,4) not null default 0, -- 0 = sin comisión (single-tenant)
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- amenities: catálogo compartido (Jacuzzi, WiFi, Alberca...). Igual que el
-- formulario de referencia, agrupadas por categoría para la UI.
-- ----------------------------------------------------------------------------
create table amenities (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (category in (
      'destacado', 'bano', 'recamara_lavanderia', 'entretenimiento', 'familia',
      'clima', 'seguridad', 'internet_oficina', 'cocina_comedor', 'exterior',
      'estacionamiento', 'servicios'
    )),
  label text not null,
  icon text,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- properties: cada cabaña/unidad. Incluye todos los campos vistos en el
-- formulario de referencia (política de menores, precios, ubicación, reglas
-- de reserva por defecto).
-- ----------------------------------------------------------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,

  name text not null,
  description text,

  capacity int not null default 1,
  bedrooms int not null default 1,
  beds int not null default 1,
  bathrooms numeric(3,1) not null default 1,

  -- Política de menores
  infants_count_toward_capacity boolean not null default false,
  max_infants int, -- null = sin límite
  max_children int, -- null = sin límite

  -- Precios base (antes de que pricing_rules los sobreescriba por fecha)
  weekday_price_mxn numeric(10,2) not null,
  weekend_price_mxn numeric(10,2) not null,
  price_tier text check (price_tier in ('accesible', 'media', 'lujo')),

  -- Ubicación
  google_maps_link text,
  lat numeric(9,6),
  lng numeric(9,6),
  show_exact_location boolean not null default false,

  pet_friendly boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),

  -- Reglas de reserva por defecto (pricing_rules las sobreescribe por fecha con prioridad)
  min_nights int not null default 1,
  max_nights int,
  min_advance_days int not null default 0,
  booking_window_days int not null default 365,
  allowed_arrival_days int[] not null default '{0,1,2,3,4,5,6}',   -- 0=domingo … 6=sábado
  allowed_departure_days int[] not null default '{0,1,2,3,4,5,6}',
  cancellation_policy text not null default 'moderada'
    check (cancellation_policy in ('flexible', 'moderada', 'estricta')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_properties_host on properties(host_id);
create index idx_properties_status on properties(status);

-- ----------------------------------------------------------------------------
-- property_amenities: qué amenidad tiene cada propiedad, con descripción
-- corta opcional (ej. "Jacuzzi para 4, con vista al bosque").
-- ----------------------------------------------------------------------------
create table property_amenities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  amenity_id uuid not null references amenities(id) on delete cascade,
  description text,
  unique (property_id, amenity_id)
);

-- ----------------------------------------------------------------------------
-- property_photos: fotos con categoría y descripción (para que ATLAS/el
-- concierge sepa qué muestra cada una). sort_order 0 = portada.
-- ----------------------------------------------------------------------------
create table property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  url text not null,
  category text, -- Sala, Cocina, Baño, Comedor, Recámara, Exterior...
  description text,
  sort_order int not null default 0
);

create index idx_photos_property on property_photos(property_id, sort_order);

-- ----------------------------------------------------------------------------
-- pricing_rules: reglas reutilizables definidas por el host (como en el
-- panel de Airbnb que mostraste: "Temporada alta", "dos noches para
-- condesa"...). Se aplican a fechas concretas vía rule_applications.
-- priority: si dos reglas aplican a la misma fecha, gana la de mayor número.
-- ----------------------------------------------------------------------------
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references hosts(id) on delete cascade,
  name text not null,
  scope text not null default 'general' check (scope in ('general', 'property')),

  min_nights int,
  max_nights int,
  price_override_mxn numeric(10,2),      -- precio fijo para esa noche, si se define
  price_adjustment_pct numeric(5,2),      -- alternativa: % de recargo/descuento
  allowed_arrival_days int[],

  priority int not null default 0,
  color text, -- para el punto de color en la leyenda del calendario del host

  created_at timestamptz not null default now()
);

create index idx_pricing_rules_host on pricing_rules(host_id);

-- ----------------------------------------------------------------------------
-- rule_applications: el "Aplicar" del calendario — a qué propiedad y rango
-- de fechas se le pegó cada regla. Puede haber varias aplicaciones
-- traslapadas; se resuelven por pricing_rules.priority.
-- ----------------------------------------------------------------------------
create table rule_applications (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references pricing_rules(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_rule_applications_property_dates
  on rule_applications(property_id, start_date, end_date);

-- ----------------------------------------------------------------------------
-- calendar_days: tabla materializada, un renglón por propiedad+día, con el
-- precio y noches mínimas YA resueltos (después de aplicar reglas). Es lo
-- que lee el buscador público y el calendario — rápido, sin recalcular
-- reglas en cada visita. Se recalcula cuando cambian reglas/bookings.
-- ----------------------------------------------------------------------------
create table calendar_days (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  date date not null,
  price_mxn numeric(10,2) not null,
  min_nights int not null default 1,
  is_available boolean not null default true,
  applied_rule_id uuid references pricing_rules(id) on delete set null,
  unique (property_id, date)
);

create index idx_calendar_days_property_date on calendar_days(property_id, date);

-- ----------------------------------------------------------------------------
-- ical_sources: sincronización con Airbnb/Booking (importación por ahora).
-- ----------------------------------------------------------------------------
create table ical_sources (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  platform text not null check (platform in ('airbnb', 'booking', 'otro')),
  ical_url_import text not null,
  last_synced_at timestamptz
);

-- ----------------------------------------------------------------------------
-- bookings
-- ----------------------------------------------------------------------------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,

  guest_name text not null,
  guest_email text,
  guest_phone text,

  check_in date not null,
  check_out date not null,
  adults int not null default 1,
  children int not null default 0,
  infants int not null default 0,
  pets boolean not null default false,

  source text not null default 'direct' check (source in ('direct', 'airbnb', 'booking')),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  total_price_mxn numeric(10,2) not null,

  created_at timestamptz not null default now(),
  check (check_out > check_in)
);

create index idx_bookings_property_dates on bookings(property_id, check_in, check_out);

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'mercadopago')),
  total_amount_mxn numeric(10,2) not null,
  platform_fee numeric(10,2) not null default 0,
  host_payout numeric(10,2) not null,
  payout_status text not null default 'pending' check (payout_status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create index idx_payments_booking on payments(booking_id);
