import { PARTNER_FEE_PCT } from '@/lib/partners'

// Términos para socios. Se muestran en /socios/terminos y se aceptan al
// registrarse.
export default function TermsContent() {
  const ex = 3000
  const net = Math.round(ex * (1 - PARTNER_FEE_PCT / 100))
  const h = 'font-semibold text-navy-deep mt-5 mb-1.5'
  return (
    <div className="text-sm text-navy-deep/90 leading-relaxed">
      <h2 className={h}>1. Tu espacio</h2>
      <p>
        Tú subes y mantienes al día las fotos, la descripción, los servicios, la ubicación, el precio y el mínimo de noches de tu cabaña, y
        puedes editarlos, pausarla o quitarla desde tu panel. Huasca Retreats revisa cada espacio antes de publicarlo y puede pedir ajustes,
        no publicarlo o pausarlo si no corresponde con lo anunciado o recibe quejas.
      </p>

      <h2 className={h}>2. Precio y comisiones</h2>
      <p>
        Tú defines tu precio por noche y a ti solo se te descuenta un {PARTNER_FEE_PCT}% de comisión: lo que recibes siempre sale de tu
        precio. Ejemplo: si tu precio es ${ex.toLocaleString('es-MX')}, tú recibes ${net.toLocaleString('es-MX')} por noche. El precio
        final al huésped lo define Huasca Retreats, que agrega su cargo de plataforma (publicidad, atención y cobro) y puede variar
        según la temporada.
      </p>

      <h2 className={h}>3. Pagos</h2>
      <p>
        El huésped paga en línea a Huasca Retreats. Te transferimos lo que te corresponde al día siguiente del check-in, a la cuenta (CLABE)
        que registres y que verifiquemos con tu comprobante. Sin datos de pago verificados no podemos depositarte.
      </p>

      <h2 className={h}>4. Tu calendario es tu responsabilidad</h2>
      <p>
        Debes mantener tu disponibilidad al día: conecta el calendario de Airbnb, Booking u otras plataformas que manejes (iCal) y bloquea en
        tu panel, el mismo día, cada fecha que reserves por fuera (WhatsApp, en persona, recomendados, etc.). Una reserva doble por no haber
        bloqueado una fecha se trata como una cancelación tuya.
      </p>

      <h2 className={h}>5. Si cancelas una reserva: puede haber penalización</h2>
      <p>
        Una reserva confirmada es un compromiso serio con el huésped. Si cancelas, cambias las condiciones o no entregas el espacio como se
        anunció, el huésped recibe el reembolso completo, tú no recibes pago por esa reserva y Huasca Retreats puede aplicarte una
        penalización, descontándola de tus pagos siguientes. La penalización puede incluir el costo de reubicar al huésped en otro alojamiento
        y las comisiones perdidas. Si se repite, tu cuenta puede ser suspendida. Si por una emergencia no puedes recibir a un huésped,
        avísanos de inmediato para buscar una solución.
      </p>

      <h2 className={h}>6. Cancelaciones de los huéspedes</h2>
      <p>
        Los huéspedes deben atenerse a las políticas de cancelación de Huasca Retreats publicadas en huascaretreats.com/politicas, igual que
        en cualquier otra cabaña del sitio. Si conforme a esas políticas el huésped tiene derecho a un reembolso, tu pago se ajusta en la misma
        proporción; si el reembolso es total, no hay pago por esa reserva.
      </p>

      <h2 className={h}>7. Cancelaciones por parte de Huasca Retreats</h2>
      <p>
        Huasca Retreats puede cancelar o mover una reserva cuando sea necesario (por ejemplo, por problemas en el espacio, seguridad, quejas
        graves o causas de fuerza mayor). En ese caso te avisamos y el pago se ajusta según corresponda.
      </p>

      <h2 className={h}>8. Atención y calidad</h2>
      <p>
        El espacio debe coincidir con las fotos y la descripción. La limpieza, el check-in y la atención al huésped durante su estancia son
        responsabilidad tuya. Usa los datos del huésped solo para atender su estancia.
      </p>

      <h2 className={h}>9. Pausar o quitar tu cabaña</h2>
      <p>
        Puedes pausar o quitar tu cabaña cuando quieras desde tu panel. Las reservas que ya estén confirmadas se respetan; para quitar una
        cabaña con reservas futuras primero hay que atenderlas con nosotros.
      </p>
    </div>
  )
}
