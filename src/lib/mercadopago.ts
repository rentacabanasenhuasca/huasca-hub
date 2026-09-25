// Cliente de Mercado Pago — SOLO para uso en el servidor (Server Actions,
// Route Handlers). MERCADOPAGO_ACCESS_TOKEN nunca tiene prefijo
// NEXT_PUBLIC_, así que Next.js no lo deja llegar al navegador.
import { MercadoPagoConfig, Payment, Customer, CustomerCard, PaymentRefund } from 'mercadopago'

let config: MercadoPagoConfig | null = null

function getConfig(): MercadoPagoConfig {
  if (!config) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      throw new Error(
        'Falta MERCADOPAGO_ACCESS_TOKEN en .env.local. Ve a tu panel de Mercado Pago (Credenciales de prueba).'
      )
    }
    config = new MercadoPagoConfig({ accessToken })
  }
  return config
}

export function getMercadoPagoPaymentClient() {
  return new Payment(getConfig())
}

export function getMercadoPagoCustomerClient() {
  return new Customer(getConfig())
}

export function getMercadoPagoCustomerCardClient() {
  return new CustomerCard(getConfig())
}

export function getMercadoPagoRefundClient() {
  return new PaymentRefund(getConfig())
}
