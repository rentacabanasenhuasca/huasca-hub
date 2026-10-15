// Páginas de aterrizaje para SEO: cada una ataca una búsqueda concreta que
// hace la gente que planea un viaje a Huasca de Ocampo ("cabañas con
// jacuzzi en Huasca", "glamping Huasca", "cabañas pet friendly"...). Cada
// página filtra automáticamente las cabañas publicadas que cumplen con esa
// intención, así que al crear o editar una propiedad en el panel aparece
// sola en las páginas que le corresponden — no hay que tocar código.

export type LandingProperty = {
  name: string
  description: string | null
  capacity: number
  pet_friendly: boolean
  amenities: string[]
}

export type LandingFaq = { q: string; a: string }

export type Landing = {
  slug: string
  /** Texto corto para links internos ("Cabañas con jacuzzi"). */
  label: string
  /** <title> (sin el " | Huasca Retreats" que agrega el layout). */
  title: string
  description: string
  h1: string
  eyebrow: string
  intro: string[]
  listHeading: string
  faqs: LandingFaq[]
  filter: (p: LandingProperty) => boolean
}

const has = (p: LandingProperty, label: string) =>
  p.amenities.some((a) => a.toLowerCase() === label.toLowerCase())
const text = (p: LandingProperty) => `${p.name} ${p.description ?? ''}`.toLowerCase()

// Preguntas que aplican a todas las páginas (datos reales del sitio y de
// las políticas publicadas en /politicas).
export const GENERAL_FAQS: LandingFaq[] = [
  {
    q: '¿Qué tan lejos está Huasca de Ocampo de la Ciudad de México?',
    a: 'Huasca de Ocampo, Hidalgo, está aproximadamente a 2 horas en auto de la CDMX, lo que lo hace ideal para una escapada de fin de semana. Fue el primer Pueblo Mágico de México y está rodeado de bosque.',
  },
  {
    q: '¿Cómo reservo una cabaña con Huasca Retreats?',
    a: 'Eliges tus fechas en huascaretreats.com, ves el precio total al instante y pagas en línea con tarjeta de forma segura. La reserva queda confirmada en ese momento, directo con nosotros y sin comisiones de plataformas como Airbnb o Booking.',
  },
  {
    q: '¿Puedo cancelar o cambiar mi reserva?',
    a: 'Sí. En las primeras 24 horas después de reservar puedes cancelar o cambiar de fecha sin penalización (solo se descuenta la comisión de la pasarela de pago). Hasta 5 días hábiles antes de tu llegada puedes cambiar de fecha o cancelar con una penalización del 20%. Consulta todos los detalles en nuestras políticas.',
  },
  {
    q: '¿Qué hay cerca de las cabañas?',
    a: 'Desde Huasca de Ocampo puedes visitar los Prismas Basálticos, la Peña del Aire, el Bosque de las Truchas, las haciendas de Santa María Regla y San Miguel Regla, y llegar en poco tiempo a Real del Monte y Mineral del Chico.',
  },
]

export const LANDINGS: Landing[] = [
  {
    slug: 'cabanas-con-jacuzzi-huasca-de-ocampo',
    label: 'Cabañas con jacuzzi',
    title: 'Cabañas con jacuzzi en Huasca de Ocampo',
    description:
      'Cabañas con jacuzzi en Huasca de Ocampo, Hidalgo, a 2 horas de la CDMX. Jacuzzi privado en medio del bosque, chimenea y fogata. Reserva directo y sin comisiones.',
    h1: 'Cabañas con jacuzzi en Huasca de Ocampo',
    eyebrow: 'Jacuzzi privado en el bosque',
    intro: [
      'Pocas cosas se disfrutan tanto en Huasca de Ocampo como un jacuzzi caliente en una noche fría de bosque. Estas cabañas tienen jacuzzi privado para que lo uses solo con tu pareja, tu familia o tus amigos, sin compartir con nadie.',
      'Son perfectas para aniversarios, escapadas románticas o un fin de semana de descanso a solo 2 horas de la Ciudad de México. Reserva directo con nosotros, ve el precio total al instante y paga en línea.',
    ],
    listHeading: 'Cabañas con jacuzzi disponibles',
    faqs: [
      {
        q: '¿El jacuzzi es privado?',
        a: 'Sí. El jacuzzi es de uso exclusivo para los huéspedes de la cabaña durante su estancia; no se comparte con otras cabañas.',
      },
      {
        q: '¿Cuál es la mejor cabaña con jacuzzi para parejas?',
        a: 'Cozy Cabin y Pistache Camper están pensadas para parejas. Si viajas en grupo, A Frame House tiene jacuzzi exterior y capacidad para grupos grandes.',
      },
    ],
    filter: (p) => has(p, 'Jacuzzi'),
  },
  {
    slug: 'cabanas-romanticas-huasca-de-ocampo',
    label: 'Cabañas románticas',
    title: 'Cabañas románticas en Huasca de Ocampo para parejas',
    description:
      'Cabañas románticas para parejas en Huasca de Ocampo: jacuzzi, chimenea, techo de cristal para ver las estrellas y decoración especial. Escapada a 2 horas de la CDMX.',
    h1: 'Cabañas románticas en Huasca de Ocampo',
    eyebrow: 'Escapadas en pareja',
    intro: [
      'Si buscas una escapada en pareja cerca de la CDMX, Huasca de Ocampo es el lugar: bosque, neblina, noches frías y cielo estrellado. Estas cabañas son íntimas, privadas y pensadas para dos.',
      'Elige entre cabañas con jacuzzi, chimenea o techo de cristal para dormir viendo las estrellas. También puedes agregar extras como decoración romántica con cena, masaje en pareja, leña o kit de s’mores al reservar.',
    ],
    listHeading: 'Cabañas ideales para parejas',
    faqs: [
      {
        q: '¿Pueden preparar una decoración romántica?',
        a: 'Sí. Al reservar puedes agregar el extra de decoración con cena para dos, o un masaje relajante en pareja en la comodidad de tu cabaña. Consulta todos los extras en la página de extras.',
      },
      {
        q: '¿Qué cabaña recomiendan para un aniversario?',
        a: 'Para un aniversario recomendamos una cabaña con jacuzzi como Cozy Cabin, o una Glasshouse con techo de cristal para dormir bajo las estrellas.',
      },
    ],
    filter: (p) => p.capacity <= 5,
  },
  {
    slug: 'glamping-huasca-de-ocampo',
    label: 'Glamping y techo de cristal',
    title: 'Glamping en Huasca de Ocampo: cabañas con techo de cristal',
    description:
      'Glamping en Huasca de Ocampo: cabañas con techo de cristal para dormir bajo las estrellas y un camper retro en el bosque. Comodidad de hotel en plena naturaleza.',
    h1: 'Glamping en Huasca de Ocampo',
    eyebrow: 'Duerme bajo las estrellas',
    intro: [
      'Nuestras Glasshouse son cabañas con techo de cristal en medio del bosque de Huasca de Ocampo: de día se llenan de luz natural y de noche puedes ver el cielo estrellado sin salir de la cama.',
      'Es glamping de verdad: cama cómoda, agua caliente, WiFi y todo lo necesario, pero rodeado de naturaleza. Si quieres algo diferente, el Pistache es un camper retro restaurado con jacuzzi, perfecto para parejas.',
    ],
    listHeading: 'Opciones de glamping',
    faqs: [
      {
        q: '¿Se pueden ver las estrellas desde la cama?',
        a: 'Sí, las Glasshouse tienen techo de cristal sobre la cama. En noches despejadas se ve el cielo estrellado del bosque de Huasca.',
      },
      {
        q: '¿Hace frío en las cabañas de cristal?',
        a: 'Huasca es frío de noche, sobre todo en invierno. Las Glasshouse de tabique (Finlandia, Islandia, Noruega y Suecia) tienen chimenea interior; te recomendamos llevar ropa abrigadora en cualquier caso.',
      },
    ],
    filter: (p) => /glasshouse|cristal|camper|glamping/.test(text(p)),
  },
  {
    slug: 'cabanas-con-chimenea-huasca-de-ocampo',
    label: 'Cabañas con chimenea',
    title: 'Cabañas con chimenea en Huasca de Ocampo',
    description:
      'Cabañas con chimenea en Huasca de Ocampo, Hidalgo: noches frías de bosque frente al fuego, fogata y asador. Para parejas, familias y grupos. Reserva directo.',
    h1: 'Cabañas con chimenea en Huasca de Ocampo',
    eyebrow: 'Noches frente al fuego',
    intro: [
      'Huasca de Ocampo es frío y con neblina gran parte del año, y no hay mejor plan que una chimenea encendida dentro de la cabaña. Estas cabañas tienen chimenea interior, y la mayoría también fogatero y asador en el jardín.',
      'Puedes pedir una carga de leña como extra al reservar para que la tengas lista desde que llegas.',
    ],
    listHeading: 'Cabañas con chimenea interior',
    faqs: [
      {
        q: '¿Incluye leña?',
        a: 'Puedes agregar una carga de leña como extra al hacer tu reserva para tenerla lista en tu cabaña.',
      },
    ],
    filter: (p) => has(p, 'Chimenea interior'),
  },
  {
    slug: 'cabanas-pet-friendly-huasca-de-ocampo',
    label: 'Cabañas pet friendly',
    title: 'Cabañas pet friendly en Huasca de Ocampo',
    description:
      'Cabañas pet friendly en Huasca de Ocampo: viaja con tu perro al bosque. Jardines y espacios al aire libre a 2 horas de la CDMX. Reserva en línea directo.',
    h1: 'Cabañas pet friendly en Huasca de Ocampo',
    eyebrow: 'Viaja con tu mascota',
    intro: [
      'Tu perro también merece un fin de semana en el bosque. Estas cabañas en Huasca de Ocampo aceptan mascotas y tienen jardín o espacio al aire libre para que disfruten juntos.',
      'Al buscar fechas indica cuántas mascotas llevas para ver el precio total. Antes de tu llegada revisa nuestro reglamento para viajar con mascotas sin contratiempos.',
    ],
    listHeading: 'Cabañas que aceptan mascotas',
    faqs: [
      {
        q: '¿Cuántas mascotas puedo llevar?',
        a: 'Indica el número de mascotas al buscar tus fechas; el sitio te muestra el precio total y si la cabaña las acepta. Si tienes dudas, escríbenos por WhatsApp.',
      },
    ],
    filter: (p) => p.pet_friendly,
  },
  {
    slug: 'cabanas-para-grupos-huasca-de-ocampo',
    label: 'Cabañas para grupos',
    title: 'Cabañas para grupos y familias en Huasca de Ocampo',
    description:
      'Cabañas y casas para grupos y familias en Huasca de Ocampo, Hidalgo: de 7 hasta 14 personas, con cocina, asador y fogata. Ideal para fines de semana y celebraciones.',
    h1: 'Cabañas para grupos en Huasca de Ocampo',
    eyebrow: 'Familias y amigos',
    intro: [
      '¿Viajas con familia o con amigos? Estas cabañas y casas en Huasca de Ocampo reciben grupos de 7 hasta 14 personas, con cocina equipada, asador, fogata y espacio para convivir.',
      'Son ideales para fines de semana largos, cumpleaños y reuniones, a solo 2 horas de la CDMX. Si son más personas, escríbenos por WhatsApp y te ayudamos a reservar más de una cabaña.',
    ],
    listHeading: 'Cabañas para grupos',
    faqs: [
      {
        q: '¿Cuál es la cabaña más grande?',
        a: 'A Frame House recibe hasta 14 personas y tiene jacuzzi exterior, chimenea y asador. Casa del bosque y las Glasshouse de tabique reciben hasta 7 personas cada una.',
      },
    ],
    filter: (p) => p.capacity >= 7,
  },
  {
    slug: 'que-hacer-en-huasca-de-ocampo',
    label: 'Qué hacer en Huasca',
    title: 'Qué hacer en Huasca de Ocampo y dónde hospedarse',
    description:
      'Guía de Huasca de Ocampo, el primer Pueblo Mágico de México: Prismas Basálticos, Peña del Aire, Bosque de las Truchas, haciendas y dónde hospedarse en cabañas en el bosque.',
    h1: 'Qué hacer en Huasca de Ocampo y dónde hospedarse',
    eyebrow: 'Guía del Pueblo Mágico',
    intro: [
      'Huasca de Ocampo, en Hidalgo, fue el primer Pueblo Mágico de México y es una de las escapadas favoritas desde la CDMX: está a unas 2 horas en auto, rodeado de bosque, con clima frío y neblina casi todo el año.',
      'Lo imperdible es visitar los Prismas Basálticos, columnas de roca volcánica con cascadas, y recorrer las antiguas haciendas mineras de Santa María Regla y San Miguel Regla. También puedes ir a la Peña del Aire, comer trucha en el Bosque de las Truchas, pasear por el centro del pueblo y visitar la presa San Antonio.',
      'Muy cerca están Real del Monte, famoso por sus pastes, y Mineral del Chico, con su parque nacional y miradores, así que puedes armar un fin de semana completo de naturaleza y pueblos mágicos.',
      'Para hospedarte, lo mejor es una cabaña en el bosque: tienes privacidad, chimenea o jacuzzi según la cabaña, fogata por la noche y la tranquilidad que no da un hotel en el centro. Estas son nuestras cabañas en Huasca de Ocampo, con reserva directa y sin comisiones.',
    ],
    listHeading: 'Dónde hospedarse en Huasca de Ocampo',
    faqs: [
      {
        q: '¿Cuántos días se necesitan para conocer Huasca de Ocampo?',
        a: 'Un fin de semana de 2 noches alcanza para conocer los Prismas Basálticos, las haciendas y el pueblo. Con 3 noches puedes sumar Real del Monte y Mineral del Chico con calma.',
      },
      {
        q: '¿Cuál es la mejor época para ir a Huasca?',
        a: 'Huasca se disfruta todo el año. En temporada de lluvias los Prismas Basálticos tienen más agua y las cascadas se ven mejor; en invierno hace frío, ideal para cabañas con chimenea o jacuzzi.',
      },
    ],
    filter: () => true,
  },
]

export function getLanding(slug: string) {
  return LANDINGS.find((l) => l.slug === slug)
}
