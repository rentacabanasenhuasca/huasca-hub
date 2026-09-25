-- ============================================================================
-- Correos de reserva configurables por cabaña: Christian quiere poder
-- definir, por cada propiedad, qué correos se mandan cuando se confirma una
-- reserva — uno para el huésped, uno para él (admin) y opcionalmente otros
-- más (ej. el equipo de limpieza), cada uno con su propio asunto y cuerpo,
-- armado con datos de la reserva vía placeholders ({{guest_name}}, etc.).
--
-- `trigger_event` queda listo para más disparadores a futuro (recordatorio,
-- seguimiento post-estancia) aunque por ahora solo se dispara
-- 'booking_created' — los demás necesitarían una tarea programada que no
-- existe todavía.
-- ============================================================================

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,

  name text not null,
  trigger_event text not null default 'booking_created' check (trigger_event in ('booking_created')),
  recipient_type text not null check (recipient_type in ('guest', 'admin', 'custom')),
  -- Solo se usa cuando recipient_type = 'custom'. Uno o varios correos
  -- separados por coma (ej. "limpieza@..., mantenimiento@...").
  recipient_emails text,

  subject text not null,
  body text not null,

  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_email_templates_property on email_templates(property_id);

alter table email_templates enable row level security;

-- Privado: solo el host dueño de la propiedad puede leer/crear/editar sus
-- plantillas de correo (mismo patrón que ical_sources_all_own).
create policy "email_templates_all_own" on email_templates
  for all using (
    property_id in (
      select id from properties
      where host_id in (select id from hosts where user_id = auth.uid())
    )
  );

grant all on email_templates to anon, authenticated, service_role;
