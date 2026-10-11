-- Carritos abandonados (ver src/lib/carts.ts). Aplicada en producción el
-- 2026-10-11 desde el MCP de Supabase.
create table if not exists public.checkout_carts (
  id uuid primary key,
  host_id uuid not null references public.hosts(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  adults int not null default 1,
  children int not null default 0,
  infants int not null default 0,
  pets int not null default 0,
  addon_selections jsonb not null default '[]'::jsonb,
  discount_code text,
  quoted_total_mxn numeric,
  guest_name text,
  guest_email text,
  guest_phone text,
  guest_notes text,
  stage text not null default 'datos' check (stage in ('datos','pago_iniciado','pago_rechazado','reservado')),
  payment_provider text,
  last_error text,
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'abierto' check (status in ('abierto','contactado','recuperado','descartado')),
  host_notified_at timestamptz,
  guest_emailed_at timestamptz,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkout_carts_host_created_idx on public.checkout_carts (host_id, created_at desc);
create index if not exists checkout_carts_pending_idx on public.checkout_carts (stage, status, updated_at);
alter table public.checkout_carts enable row level security;
-- Sin políticas públicas: solo el servidor (service role) lee y escribe.
alter table public.hosts add column if not exists cart_auto_email boolean not null default false;
