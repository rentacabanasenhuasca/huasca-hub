@AGENTS.md

# huasca-hub — contexto del proyecto

Plataforma propia de reservas de **Huasca Retreats** (Huasca de Ocampo, Hidalgo, ~13 propiedades),
independiente de TitansHub. Objetivo a futuro: convertirla en un hub/marketplace para que otros
anfitriones administren sus rentas vacacionales (multi-tenant por `host_id`).
Dueño: Christian Palacios. Idioma de la UI y de las explicaciones: **español**.
Christian está aprendiendo: después de cada cambio, explica en 3-4 líneas qué hiciste y por qué.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind 4) — ver AGENTS.md: leer docs en node_modules/next/dist/docs antes de escribir código.
- Supabase (Postgres + Auth + RLS). Migraciones en `supabase/migrations/`, datos iniciales en `supabase/seed.sql`.
- Pagos: Stripe (PaymentIntent + Elements) y Mercado Pago (CardPayment Brick). Webhooks en `/api/webhooks/{stripe,mercadopago}`.
- Correos: SMTP vía nodemailer (`src/lib/email.ts`), plantillas por propiedad y por evento.
- Moneda única: MXN.

## Qué existe
- `/` sitio público: hero con carrusel, buscador con selector de huéspedes (adultos/niños/bebés/mascotas), tarjetas con precio real, calendario de disponibilidad.
- `/cabanas/[id]` detalle + galería + widget de reserva; `/cabanas/[id]/reservar` checkout. `booking-finalize.ts` crea la reserva de forma atómica y hace rollback si algo falla.
- `/reserva-confirmada`, `/politicas`, `/reglamento`, `/login`.
- `/admin`: propiedades (CRUD, fotos, amenidades, precios por ocupación, políticas de cancelación, fuentes iCal, plantillas de correo), calendario multi-propiedad (reglas de precio por color, arrastrar para seleccionar, bloqueo/apertura manual, mínimo de noches por fecha y por día, reservas manuales; Airbnb=rosa, Booking=azul, directa=verde olivo, modal con datos del huésped), reglas, extras/add-ons, portada (hero media), huéspedes (exportes CSV y análisis), configuración.
- `/api/ical/[propertyId]` exporta el calendario .ics para Airbnb/Booking. La importación iCal se dispara desde el admin (aún no hay cron automático).

## Reglas de negocio
- Niños de 3+ años cuentan como huésped para capacidad y precio. Bebés (<3) no.
- Tarifa de fin de semana = noches de viernes y sábado.
- Reglas de precio con prioridad: el número más alto gana.
- RLS en todas las tablas: un host solo ve/edita lo suyo; propiedades `published` son públicas.

## Pendiente
1. Aplicar migraciones a Supabase real (`npx supabase link` + `npx supabase db push`).
2. Deploy en Vercel + variables de entorno + dominio (Cloudflare).
3. Configurar webhooks de Stripe (`STRIPE_WEBHOOK_SECRET` vacío) y Mercado Pago apuntando al dominio de producción.
4. Cron para sincronizar iCal cada 15-30 min (evitar doble reserva).
5. Marketplace: Stripe Connect / Mercado Pago Marketplace con comisión por host (`commission_rate`).

## Verificación antes de dar por terminado un cambio
`npx tsc --noEmit && npx eslint && npx next build`
