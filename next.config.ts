import type { NextConfig } from "next";

// Redirecciones 301 de las direcciones del sitio viejo (WordPress en
// HostGator) que Google todavía tiene indexadas. Sin esto, esas URLs dan 404
// y se pierde el posicionamiento que ya habían ganado; con 301 Google pasa
// ese "valor" a la página nueva equivalente. Las URLs viejas con
// ?wpbs-start-year=... (calendario del plugin WP Booking System) también
// caen aquí: Next ignora el query al comparar la ruta.
const legacyRedirects: Record<string, string> = {
  // Páginas de cabañas del WordPress viejo
  "/pistache-camper": "/cabanas/pistache-camper",
  "/cozycabin": "/cabanas/cozy-cabin",
  "/aframecabin": "/cabanas/a-frame-house",
  // Ligas cortas /c/... del sitio viejo
  "/c/pistacherv": "/cabanas/pistache-camper",
  "/c/glasshousefinlandia": "/cabanas/glasshouse-finlandia",
  "/c/glasshousegaleria": "/cabanas/glasshouse-galeria",
  // URLs con "copia" de cabañas creadas con "Duplicar" (oct-2026 se
  // renombraron a su nombre real; Google ya tenía indexadas las viejas)
  "/cabanas/glasshouse-islandia-copia": "/cabanas/glasshouse-noruega",
  "/cabanas/glasshouse-islandia-copia-copia": "/cabanas/glasshouse-finlandia",
  "/cabanas/glasshouse-islandia-copia-copia-copia": "/cabanas/glasshouse-suecia",
  "/cabanas/glasshouse-natural-copia": "/cabanas/glasshouse-diseno",
  "/cabanas/glasshouse-natural-copia-copia": "/cabanas/glasshouse-arte",
  "/cabanas/glasshouse-natural-copia-copia-copia": "/cabanas/glasshouse-galeria",
  // Páginas viejas sin equivalente directo → portada
  "/cabanagretel": "/",
  "/elementor-3836": "/",
  "/hospedaje-boutique-en-la-naturaleza-que-buscar": "/",
};

const nextConfig: NextConfig = {
  async redirects() {
    return Object.entries(legacyRedirects).flatMap(([source, destination]) => [
      { source, destination, permanent: true },
      { source: `${source}/`, destination, permanent: true },
      // Subpáginas de las cabañas renombradas (p. ej. .../reservar)
      ...(source.startsWith("/cabanas/")
        ? [{ source: `${source}/:path+`, destination: `${destination}/:path+`, permanent: true }]
        : []),
    ]);
  },
};

export default nextConfig;
