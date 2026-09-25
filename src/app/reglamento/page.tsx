import { LegalPageShell, Section, SubHeading, List, Callout } from '@/components/legal/LegalPageLayout'

export const metadata = {
  title: 'Reglamento — Huasca Retreats',
  description: 'Reglamento de estancia: horarios, mascotas, comportamiento y más.',
}

export default function ReglamentoPage() {
  return (
    <LegalPageShell title="Reglamento" subtitle="Huasca Retreats — condiciones de estancia en nuestras propiedades.">
      <Section title="1. Llegada, horarios y acceso">
        <p>
          <strong className="text-navy-deep">Responsabilidad:</strong> nuestro servicio ofrece una plataforma de
          renta de propiedades vacacionales, no es un hotel. No contamos con personal de apoyo en el lugar durante
          la estancia, por lo que todas las solicitudes o requerimientos deben ser comunicados al momento de la
          reservación. La responsabilidad durante la estancia recae exclusivamente en el huésped, quien asume todas las
          obligaciones relacionadas con el uso y cuidado de la propiedad.
        </p>
        <List
          items={[
            <>
              <strong className="text-navy-deep">Hora de entrada:</strong> entre las 3:00 p.m. y las 10:00 p.m. Al
              llegar, es necesario avisar al encargado correspondiente, ya que solo se permitirá el acceso a
              huéspedes con reservación confirmada.
            </>,
            <>
              <strong className="text-navy-deep">Registro:</strong> la mayor parte de nuestros espacios tienen
              acceso de forma autónoma — asegúrese de entender los accesos antes de su llegada. En Bosquecielo, el
              huésped responsable debe presentar una identificación oficial y el correo de reserva.
            </>,
            <>
              <strong className="text-navy-deep">Capacidad máxima:</strong> no se permite la entrada de personas
              adicionales a las cabañas, respetando la capacidad máxima indicada. Toda persona, sin importar la
              edad, cuenta como huésped.
            </>,
            <>
              <strong className="text-navy-deep">Estacionamiento:</strong> los vehículos deben estacionarse en los
              espacios designados por la administración.
            </>,
            <>
              <strong className="text-navy-deep">Hora de salida:</strong> a las 10:00 a.m., con una tolerancia
              máxima de 60 minutos.
            </>,
          ]}
        />
      </Section>

      <Section title="2. Early check-in y late check-out">
        <p>
          La hora de entrada está marcada a las 3:00 p.m. Si desea llegar antes, debe solicitarlo previamente, y se
          cobrará según la disponibilidad.
        </p>
        <p>
          La salida es a las 10:00 a.m. Si el huésped desea permanecer más tiempo, debe solicitarlo previamente, y
          se cobrará según la disponibilidad.
        </p>
        <p>Si no se ha notificado y el huésped no abandona la cabaña a la hora indicada, se cobrará una noche adicional.</p>
      </Section>

      <Section title="3. Posibles retrasos en la entrega">
        <p>
          Durante temporadas vacacionales, fines de semana largos (puentes) o días de alta ocupación, puede existir
          un retraso en la entrega de la cabaña de hasta 60 minutos debido a la saturación de salidas y procesos de
          limpieza.
        </p>
        <SubHeading>Compensación ofrecida</SubHeading>
        <List
          items={[
            'En caso de que el check-in se retrase más de 30 minutos sobre la hora oficial (después de las 3:30 p.m.), ofrecemos una cortesía de bienvenida (por ejemplo: leña adicional para la fogata, una botella de vino o late check-out sin costo, sujeto a disponibilidad).',
            'Si el retraso llegara a superar los 60 minutos, además de la cortesía, podrá solicitar una compensación simbólica equivalente al 5% del valor de la primera noche.',
          ]}
        />
        <SubHeading>Limitaciones</SubHeading>
        <List
          items={[
            'Estas condiciones aplican únicamente a retrasos atribuibles al equipo de operación (limpieza y logística).',
            'No aplican en casos de fuerza mayor (tormentas, fallas eléctricas generales, cierres de carretera, etc.).',
            'La compensación sustituye cualquier otro reclamo o reembolso relacionado con la hora de entrada.',
          ]}
        />
      </Section>

      <Section title="4. Reglas para fiestas y reuniones">
        <SubHeading>a) Prohibiciones</SubHeading>
        <List
          items={[
            'No se permite la realización de eventos o fiestas que involucren música a volumen alto, uso de equipos de sonido profesional, o actividades que generen molestias al vecindario después de las 11:00 p.m.',
            'Está prohibido exceder el número de personas permitido en la propiedad (incluyendo invitados que no estén registrados).',
            'El uso de fuegos artificiales, luces estroboscópicas o cualquier actividad que implique riesgo de daño a la propiedad está estrictamente prohibido.',
            'No se tolerará el uso de sustancias ilegales, comportamiento inapropiado, o el consumo de alcohol en áreas no designadas.',
          ]}
        />
        <SubHeading>b) Permisos especiales</SubHeading>
        <List
          items={[
            'Las reuniones pequeñas (máximo 12 personas) están permitidas siempre que se respeten los horarios de silencio, no se exceda el número de ocupantes indicado en la reservación, y no quede basura en el jardín, casa y/o alrededores (esto genera un cargo por limpieza extraordinaria).',
            'Para eventos especiales, se debe solicitar permiso con mínimo 7 días de anticipación, proporcionar detalles del evento, y pagar un depósito adicional reembolsable para cubrir posibles daños o limpieza extra.',
          ]}
        />
        <SubHeading>c) Consecuencias por incumplimiento</SubHeading>
        <p>
          El incumplimiento de estas normas resultará en la cancelación inmediata de la reserva, la pérdida del
          depósito, y/o cargos adicionales por daños o molestias ocasionadas.
        </p>
        <SubHeading>d) Horarios de silencio</SubHeading>
        <p>Horario de silencio obligatorio: 11:00 p.m. a 8:00 a.m.</p>
        <SubHeading>e) Notificación a vecinos</SubHeading>
        <p>
          Si se realiza una reunión dentro de los parámetros permitidos, se debe notificar previamente a la
          administración o a los vecinos cercanos para evitar inconvenientes.
        </p>
      </Section>

      <Section title="5. Horarios de descanso">
        <p>
          Entre las 11:00 p.m. y las 8:00 a.m., se debe mantener un ambiente tranquilo. No se permite el uso de
          dispositivos de sonido ni cualquier actividad que genere ruidos molestos.
        </p>
      </Section>

      <Section title="6. Aceptación del espacio y adecuación a las necesidades del huésped">
        <SubHeading>a) Aceptación del estado del espacio</SubHeading>
        <List
          items={[
            'Al ingresar al espacio, el huésped acepta que la propiedad está en condiciones adecuadas y funcionales según lo indicado en el listado. Cualquier desperfecto o inconveniente deberá ser reportado a la administración dentro de las primeras 2 horas posteriores al check-in.',
            'No se realizarán reembolsos ni compensaciones por expectativas no alineadas con las fotografías o descripción proporcionadas al momento de la reserva.',
          ]}
        />
        <SubHeading>b) Adecuación a las necesidades</SubHeading>
        <List
          items={[
            'Es responsabilidad del huésped asegurarse de que el espacio cumpla con los requisitos específicos de su estancia antes de confirmar la reserva. Esto incluye, pero no se limita a, número de habitaciones, capacidad, servicios disponibles, caminos, transporte y restricciones.',
            'La administración no podrá realizar modificaciones en la configuración de la propiedad, cambios de la misma, ni agregar servicios adicionales no especificados previamente.',
          ]}
        />
        <SubHeading>c) Consecuencias por incumplimiento</SubHeading>
        <p>
          La administración no será responsable por inconvenientes derivados de una mala selección de la propiedad
          por parte del huésped.
        </p>
      </Section>

      <Section title="7. Insectos y fauna local">
        <p>Nuestras cabañas se encuentran en un entorno boscoso y natural en Huasca de Ocampo.</p>
        <p>
          Realizamos fumigaciones profesionales y mantenemos las instalaciones limpias y protegidas; sin embargo,
          por la naturaleza del ecosistema, es posible que durante su estancia aparezcan insectos o pequeños
          animales (por ejemplo: arañas, hormigas, mariposas, etc.), especialmente en temporada de lluvias. Esto es
          normal en un alojamiento rodeado de bosque y no implica falta de limpieza o incumplimiento de servicio.
        </p>
        <SubHeading>Nuestro compromiso</SubHeading>
        <List items={['Fumigación preventiva regular.', 'Revisión y limpieza antes de cada entrada.']} />
        <SubHeading>Recomendaciones al huésped</SubHeading>
        <List
          items={[
            'Mantener puertas y ventanas cerradas, especialmente por la noche.',
            'No dejar alimentos al descubierto.',
            'Informar de inmediato en caso de detectar fauna dentro de la cabaña, para brindar apoyo.',
          ]}
        />
        <p>
          <strong className="text-navy-deep">Nota importante:</strong> la presencia ocasional de fauna local es
          parte natural de la experiencia y no constituye motivo de reembolso ni cancelación.
        </p>
      </Section>

      <Section title="8. Mascotas">
        <p>
          Se permite un máximo de una mascota de más de 40 cm o dos de menos de 40 cm, sin costo adicional, siempre
          que se respete la limpieza en áreas comunes y abiertas. No se permite que las mascotas suban a camas o
          sillones; si esto sucede, se cobrará un costo de limpieza adicional de $1,000 MXN. Las mascotas deben
          portar correa en todo momento.
        </p>
        <p>
          Los propietarios de las mascotas serán responsables de cubrir cualquier daño causado por estas, así como
          los gastos médicos en caso de agresión a otros huéspedes, empleados o mascotas. La empresa no se
          responsabiliza por enfermedades, fugas o accidentes sufridos por las mascotas.
        </p>
      </Section>

      <Section title="9. Comportamiento">
        <p>
          Los huéspedes deben moderar el tono de voz y evitar conductas que perturben a los demás. Eventos como
          bodas, reuniones escolares o similares deben ser aprobados previamente.
        </p>
        <SubHeading>Prohibido</SubHeading>
        <List
          items={[
            'Sacar muebles o cobertores del interior de la cabaña.',
            'Fumar en interiores.',
            'Dejar fogatas, asadores o chimeneas sin supervisión. Las fogatas solo se permiten en áreas designadas.',
            'Consumir alcohol en exceso o comportarse de manera inapropiada.',
            'Tirar colillas o residuos de basura en el jardín.',
          ]}
        />
        <p>
          Los adultos deben supervisar a los menores a su cargo, especialmente en áreas inclinadas o resbaladizas.
          La administración no se hace responsable por accidentes ocurridos dentro de las instalaciones.
        </p>
      </Section>

      <Section title="10. Objetos olvidados">
        <p>
          Los objetos olvidados serán resguardados por 30 días. Pasado este tiempo, serán donados o reciclados. Los
          huéspedes deben gestionar su recuperación; no ofrecemos servicio de mensajería.
        </p>
      </Section>

      <Section title="11. Descargo de responsabilidad">
        <p>
          Al hospedarse en Huasca Retreats, el huésped asume el riesgo inherente de participar en actividades al
          aire libre. No nos hacemos responsables por accidentes o lesiones ocurridos dentro de nuestras
          instalaciones, incluyendo pero no limitándose a caídas, resbalones, o cualquier accidente relacionado con
          el entorno natural, como picaduras de insectos, mordeduras de animales o lesiones causadas por la fauna
          local. Recomendamos a nuestros huéspedes tomar precauciones y estar atentos a su entorno en todo momento.
        </p>
        <Callout>En caso de emergencia llame a Protección Civil Huasca: 771 169 2728, o al 911 desde su teléfono.</Callout>
      </Section>

      <Section title="12. Filmación">
        <p>
          Está prohibido grabar videos o tomar fotografías con fines comerciales sin autorización. En áreas
          comunes y exteriores puede haber cámaras de videovigilancia, nunca en espacios privados. La mayor parte
          de nuestras propiedades poseen entrada autónoma.
        </p>
      </Section>
    </LegalPageShell>
  )
}
