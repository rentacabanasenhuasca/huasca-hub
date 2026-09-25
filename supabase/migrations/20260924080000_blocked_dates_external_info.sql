-- ============================================================================
-- Más contexto sobre un bloqueo que viene de un calendario externo (Airbnb,
-- Booking, etc.): guardamos el texto que trae el propio evento de iCal
-- (SUMMARY/DESCRIPTION) por si trae un código de confirmación u otro dato
-- útil. La mayoría de las plataformas NO comparten el nombre del huésped
-- por iCal (es una limitación de la fuente, no de esta app) — esto es lo
-- máximo que se puede sacar de ahí.
-- ============================================================================

alter table blocked_dates
  add column external_summary text;
