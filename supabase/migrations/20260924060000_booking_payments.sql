-- ============================================================================
-- Pagos en línea (Stripe / Mercado Pago): agrega los campos que necesita
-- bookings para el flujo de checkout — el huésped elige el proveedor, se le
-- cobra el total y se guarda su método de pago para cargos futuros por
-- daños. La tabla `payments` ya existía (creada en el schema inicial).
-- ============================================================================

alter table bookings
  add column payment_provider text check (payment_provider in ('stripe', 'mercadopago')),
  -- Stripe: Customer + PaymentMethod guardados = puedes cobrar cargos fuera
  -- de sesión después (depósito por daños) sin pedirle la tarjeta de nuevo.
  add column stripe_customer_id text,
  add column stripe_payment_method_id text,
  add column stripe_payment_intent_id text,
  -- Mercado Pago: customer_id + card_id (tarjeta guardada) para lo mismo.
  add column mp_customer_id text,
  add column mp_card_id text,
  add column mp_payment_id text,
  add column guest_notes text;

-- Una reserva puede quedar "pending_payment" mientras se confirma el cobro
-- (por ejemplo esperando 3-D Secure o el webhook del proveedor) antes de
-- pasar a 'confirmed'. 'payment_failed' es para intentos que no se
-- completaron — no bloquean las fechas.
alter table bookings drop constraint bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'confirmed', 'cancelled', 'payment_failed'));

create index idx_bookings_stripe_payment_intent on bookings(stripe_payment_intent_id);
create index idx_bookings_mp_payment on bookings(mp_payment_id);
