import { LegalPageShell, Section, SubHeading, List } from '@/components/legal/LegalPageLayout'

export const metadata = {
  title: 'Políticas de Huasca Retreats',
  description:
    'Políticas de cancelaciones, cambios, reembolsos, garantía de reserva y uso del método de pago de Huasca Retreats.',
  // Sin esto hereda canonical "/" del layout y Google la trata como copia de la portada.
  alternates: { canonical: '/politicas' },
}

export default function PoliticasPage() {
  return (
    <LegalPageShell title="Políticas de Huasca Retreats" subtitle="Condiciones de reservación, cancelación y servicios adicionales.">
      <Section title="1. Cancelaciones y cambios">
        <p>
          Para cualquier cambio o cancelación deberá solicitarlo al correo{' '}
          <a href="mailto:reservaciones@huascaretreats.com" className="text-gold underline underline-offset-2">
            reservaciones@huascaretreats.com
          </a>{' '}
          o por WhatsApp, proporcionando su clave de confirmación y el nombre de quien reservó.
        </p>
        <List
          items={[
            <>
              <strong className="text-navy-deep">Primeras 24 horas:</strong> a partir de la confirmación de su
              reserva, puede cancelar o modificar la fecha sin penalización. En caso de cancelación solo se cobra
              la comisión de la pasarela de pago (3.6% + $3 MXN + IVA).
            </>,
            <>
              <strong className="text-navy-deep">Hasta 5 días hábiles antes de la llegada:</strong> la cancelación
              tiene una penalización del 20% sobre el total de la reserva por gastos administrativos. En este
              periodo también puede solicitar cambio de fecha sin penalización (sujeto a disponibilidad y a la
              tarifa vigente en la nueva fecha), válido dentro del año en curso.
            </>,
            <>
              <strong className="text-navy-deep">Menos de 5 días antes de la llegada:</strong> no aplican
              cancelaciones ni cambios de fecha. No hay reembolso.
            </>,
            <>
              <strong className="text-navy-deep">Reservas hechas el mismo día o dentro de los 5 días previos a la
              estancia:</strong> no aplican cambios ni cancelaciones. No hay reembolso.
            </>,
            <>
              <strong className="text-navy-deep">Ofertas, descuentos o cupones</strong> marcados como &ldquo;No
              reembolsables&rdquo;: no aplican estas políticas de cancelación.
            </>,
          ]}
        />
        <p>
          Al garantizar su reserva, usted declara haber leído, entendido y aceptado íntegramente esta política de
          cancelaciones y cambios, misma que forma parte de los términos y condiciones del servicio contratado.
        </p>

        <SubHeading>Pago de saldo pendiente (reservas con anticipo del 50%)</SubHeading>
        <p>
          Para reservas confirmadas con un anticipo del 50%, el saldo restante deberá liquidarse a más tardar 5
          días naturales antes de la fecha de llegada.
        </p>
        <p>
          Antes de esa fecha, se enviará un recordatorio por WhatsApp o correo solicitando cubrir el saldo
          pendiente. Si el saldo no se cubre a 5 días naturales de la llegada, Huasca Retreats se reserva el
          derecho de cancelar la reserva y liberar la unidad, aplicando la política de cancelación vigente (sin
          reembolso del anticipo ya entregado, conforme a lo señalado para cancelaciones dentro de los 5 días
          previos a la llegada). En caso de que el huésped haya autorizado el cargo a su tarjeta al momento de la
          reserva, Huasca Retreats podrá aplicar el cargo del saldo restante directamente a dicha tarjeta sin
          necesidad de contacto previo, para evitar la cancelación.
        </p>
        <p>
          Recomendamos liquidar el saldo con anticipación para garantizar su estancia y evitar la cancelación
          automática de la reserva.
        </p>

        <SubHeading>Cancelación por causa imputable al prestador del servicio o fuerza mayor</SubHeading>
        <p>
          Si la cancelación se debe a causas atribuibles a Huasca Retreats (sobreventa/doble reserva, cancelación
          unilateral del anfitrión, propiedad no entregable en las condiciones contratadas, cierre no informado de
          la unidad) o a fuerza mayor ajena a ambas partes (desastres naturales, clima extremo, disposiciones
          gubernamentales), el huésped recibe reembolso total del 100% del monto pagado, sin penalización ni
          descuento de comisión de pasarela de pago. Huasca Retreats absorbe el costo de la comisión de la
          pasarela de pago.
        </p>
      </Section>

      <Section title="2. Conocimiento y aceptación de la propiedad reservada">
        <p>
          Al confirmar su reserva, usted declara haber revisado la información publicada por Huasca Retreats sobre
          la propiedad —fotografías, descripción, ubicación, amenidades, capacidad y condiciones— y acepta la
          propiedad tal como fue mostrada y descrita al momento de reservar.
        </p>
        <p>
          Huasca Retreats garantiza que la propiedad entregada corresponde fielmente a lo publicado. Sin embargo,
          percepciones o expectativas subjetivas del huésped que no representen un incumplimiento real de lo
          publicado —por ejemplo, sobre el tamaño, el ambiente, el clima, la señal telefónica o de internet, ruidos
          propios de una zona boscosa o rural, entre otras— no constituyen motivo de cancelación, cambio de fecha
          ni reembolso, dado que dicha información estuvo disponible y fue aceptada previamente por el huésped al
          momento de reservar.
        </p>
        <p>
          Cualquier inconformidad relacionada con un incumplimiento real y comprobable de lo publicado (por
          ejemplo, que la propiedad entregada no corresponda a la reservada, o carezca de una amenidad expresamente
          ofrecida) deberá reportarse a Huasca Retreats dentro de las primeras 2 horas posteriores a su llegada,
          para su revisión y, en su caso, solución o compensación correspondiente.
        </p>
      </Section>

      <Section title="3. Proceso de reembolso">
        <p>Todo reembolso se devuelve a la misma forma de pago utilizada al garantizar la reserva:</p>
        <List
          items={[
            <>
              <strong className="text-navy-deep">Pago con tarjeta:</strong> el reembolso se aplica automáticamente
              a la misma tarjeta, en un plazo de 5 a 10 días hábiles, sujeto a los tiempos del banco emisor.
            </>,
            <>
              <strong className="text-navy-deep">Pago por transferencia o depósito:</strong> se solicita ficha de
              depósito, datos bancarios (CLABE, nombre e institución del titular) e INE de quien recibirá el
              depósito y de quien realizó el pago. El reembolso se aplica en un plazo de 10 días hábiles a partir
              del ingreso de la solicitud completa.
            </>,
          ]}
        />
      </Section>

      <Section title="4. Garantía de reserva">
        <p>
          Toda reserva debe garantizarse dentro de las 24 horas posteriores a la solicitud (o en la fecha indicada
          por el ejecutivo), mediante pago con tarjeta a través del sitio web o link de pago, depósito o
          transferencia por el 100% del total. Si no se garantiza, Huasca Retreats no está obligado a respetar la
          reserva.
        </p>
        <p>
          Al pagar, envíe su comprobante a{' '}
          <a href="mailto:reservaciones@huascaretreats.com" className="text-gold underline underline-offset-2">
            reservaciones@huascaretreats.com
          </a>{' '}
          o por WhatsApp.
        </p>
        <p>
          En caso de pago en efectivo, la garantía se valida el siguiente día hábil en que se refleje el depósito
          en la cuenta bancaria de Huasca Retreats.
        </p>
      </Section>

      <Section title="5. Sobreventa (overbooking)">
        <p>
          En caso de sobreventa, se ofrecerá una propiedad de categoría igual o superior. Si la propiedad
          sustituta tiene un valor menor, se reembolsará la diferencia. Si no se ofrece alternativa o el huésped no
          la acepta, se reembolsará el importe íntegro de la estancia.
        </p>
      </Section>

      <Section title="6. Resguardo y uso del método de pago">
        <p>
          Huasca Retreats no captura, ve, almacena ni tiene acceso a los datos completos de su tarjeta o método de
          pago. Todo el proceso de pago es operado por Stripe, nuestra pasarela de pago, certificada como PCI
          Service Provider Level 1 —el nivel más alto de certificación disponible en la industria de pagos— y
          sujeta al Estándar de Seguridad de Datos de la Industria de Tarjetas de Pago (PCI DSS).
        </p>
        <p>
          Huasca Retreats únicamente recibe una referencia tokenizada del método de pago, generada y resguardada
          por Stripe, que no contiene el número completo de la tarjeta ni datos sensibles de autenticación. Ambas
          partes —Stripe y Huasca Retreats— comparten la responsabilidad de proteger su información conforme a la
          normativa aplicable, incluyendo la Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares y su Reglamento.
        </p>
        <p>
          Esta referencia de pago se conserva y utiliza exclusivamente para los usos específicos que usted autoriza
          expresamente al garantizar su reserva:
        </p>
        <List
          items={[
            'Cargos por servicios o productos adicionales solicitados y confirmados por usted durante su estancia.',
            'Cargos por daños a la propiedad derivados de un uso negligente o imputable a usted o a las personas bajo su responsabilidad.',
          ]}
        />
        <p>
          Ningún otro uso de su método de pago está autorizado. Sus datos personales y de pago no se comparten,
          venden ni transfieren a terceros distintos de Stripe, salvo requerimiento de autoridad competente. Puede
          ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) escribiendo a{' '}
          <a href="mailto:reservaciones@huascaretreats.com" className="text-gold underline underline-offset-2">
            reservaciones@huascaretreats.com
          </a>
          . Consulte nuestro Aviso de Privacidad completo en huascaretreats.com.
        </p>
      </Section>

      <Section title="7. Autorización de cargos por extras y por daños a la propiedad">
        <p>
          Al garantizar su reserva, usted otorga su consentimiento expreso para que Huasca Retreats inicie, a
          través de la referencia de pago resguardada por Stripe, uno o más cargos posteriores en su nombre, bajo
          las siguientes condiciones específicas:
        </p>

        <SubHeading>a) Momento y frecuencia de los cargos</SubHeading>
        <p>
          No son recurrentes ni programados; ocurren únicamente cuando se presenta alguno de los dos supuestos
          siguientes durante o al cierre de su estancia:
        </p>
        <List
          items={[
            <>
              <strong className="text-navy-deep">Extras contratados:</strong> al momento en que usted solicita y
              confirma un servicio adicional (masaje, kit Aperol, picnic, decoración, leña u otro) con el equipo o
              el anfitrión.
            </>,
            <>
              <strong className="text-navy-deep">Daños a la propiedad:</strong> al concluir su estancia, si se
              documenta un desperfecto, rotura o pérdida de mobiliario/equipo imputable a negligencia o mal uso por
              parte de usted o sus acompañantes.
            </>,
          ]}
        />

        <SubHeading>b) Cómo se determina el monto</SubHeading>
        <List
          items={[
            <>
              <strong className="text-navy-deep">Extras:</strong> conforme a la lista de precios vigente informada
              previamente.
            </>,
            <>
              <strong className="text-navy-deep">Daños:</strong> conforme al costo real de reparación o
              reposición, sustentado con evidencia fotográfica y, en su caso, cotización o comprobante del
              proveedor.
            </>,
          ]}
        />

        <SubHeading>c) Notificación previa</SubHeading>
        <p>
          Cada cargo se le notificará por WhatsApp o correo antes de procesarse, indicando monto, concepto y
          evidencia (en caso de daños). Usted podrá presentar una aclaración dentro de las 48 horas siguientes a la
          notificación, antes de que el cargo se ejecute.
        </p>

        <SubHeading>d) Alcance del consentimiento</SubHeading>
        <p>
          Este consentimiento cubre únicamente los dos supuestos anteriores. No autoriza cargos recurrentes,
          suscripciones ni ningún otro concepto no descrito en esta política. Usted puede solicitar la eliminación
          de su método de pago guardado, una vez concluidas sus obligaciones derivadas de la reserva, escribiendo a{' '}
          <a href="mailto:reservaciones@huascaretreats.com" className="text-gold underline underline-offset-2">
            reservaciones@huascaretreats.com
          </a>
          .
        </p>
      </Section>
    </LegalPageShell>
  )
}
