-- ============================================================================
-- Noches mínimas por día de la semana, como configuración inicial de la
-- propiedad (ej. exigir 2 noches si la llegada es viernes o sábado, pero
-- dejar 1 noche el resto de la semana) — sin necesidad de crear una regla de
-- precio aparte. Guarda solo los días que el host quiere sobreescribir; el
-- resto sigue usando properties.min_nights (comportamiento actual, sin
-- cambios para propiedades ya existentes).
--
-- Formato: jsonb tipo {"5": 2, "6": 2} — llave = día de la semana
-- (0=domingo … 6=sábado, mismo criterio que allowed_arrival_days), valor =
-- noches mínimas para ese día.
-- ============================================================================

alter table properties
  add column min_nights_by_day jsonb not null default '{}'::jsonb;
