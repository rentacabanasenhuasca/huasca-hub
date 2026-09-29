-- Slugs amigables para las URLs públicas de cada cabaña (/cabanas/<slug>)
-- en vez del UUID crudo. Buenos para SEO y para compartir en redes.

create extension if not exists unaccent;

alter table properties add column if not exists slug text;

-- Genera un slug base a partir del nombre: sin acentos, minúsculas,
-- espacios y símbolos convertidos en guiones.
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

-- Backfill: un slug único por propiedad. Si dos propiedades comparten
-- nombre (o el nombre queda vacío tras limpiar símbolos), se numera
-- -2, -3, etc. para que nunca choquen.
with base as (
  select
    id,
    coalesce(nullif(slugify(name), ''), 'cabana') as base_slug,
    row_number() over (
      partition by coalesce(nullif(slugify(name), ''), 'cabana')
      order by created_at, id
    ) as rn
  from properties
  where slug is null
)
update properties p
set slug = case when base.rn = 1 then base.base_slug else base.base_slug || '-' || base.rn end
from base
where p.id = base.id;

create unique index if not exists properties_slug_key on properties (slug);
alter table properties alter column slug set not null;
