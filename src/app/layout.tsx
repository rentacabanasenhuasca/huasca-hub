import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { createServiceClient } from "@/lib/supabase/service";
import WhatsAppFloatButton from "@/components/WhatsAppFloatButton";

// Tipografía más bold y contemporánea que las fuentes de sistema que se
// usaban antes (Georgia + sans del sistema). Fraunces en su corte más
// grueso da los titulares editoriales-pero-modernos; Plus Jakarta Sans es
// una sans geométrica bold, muy usada en sitios de hospitalidad/boutique
// actuales. Se cargan como variables CSS y globals.css las conecta a
// .font-display / .font-body — no hay que subir ningún archivo de fuente.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Huasca Hub — Panel de anfitrión",
  description: "Plataforma propia de reservas de Huasca Retreats",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El teléfono de WhatsApp del botón flotante viene del host en la base de
  // datos (hosts.phone, editable en /admin/configuracion) — nunca fijo en
  // el código. Hoy el sitio es de un solo host (Huasca Retreats), por eso
  // toma el primero; si esto se vende a otros hospedajes con su propio
  // dominio, aquí es donde habría que resolver "cuál host" según el
  // dominio de la petición en vez de tomar siempre el primero.
  const supabase = createServiceClient();
  const { data: host } = await supabase
    .from("hosts")
    .select("phone")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <html lang="es" className={`h-full antialiased ${fraunces.variable} ${plusJakarta.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <WhatsAppFloatButton phone={host?.phone ?? null} />
      </body>
    </html>
  );
}
