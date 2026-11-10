-- Correos pendientes de mandar para reservas creadas directo en la base de
-- datos (por ejemplo, reservas manuales que Claude registra desde Supabase
-- cuando el huésped pagó por transferencia). Quien inserte la reserva pone
-- emails_pending = true y el servidor del sitio (instrumentation.ts →
-- src/lib/pending-booking-emails.ts) manda todos los correos activos de la
-- cabaña en menos de un minuto y lo marca como enviado.
-- Las reservas del checkout y del panel no usan esta bandera (mandan sus
-- correos ellas mismas), así que nunca se duplican.
-- Aplicada en producción el 2026-11-10 desde el MCP de Supabase.
alter table public.bookings
  add column if not exists emails_pending boolean not null default false,
  add column if not exists emails_sent_at timestamptz,
  add column if not exists emails_result text;

create index if not exists bookings_emails_pending_idx
  on public.bookings (created_at)
  where emails_pending;
