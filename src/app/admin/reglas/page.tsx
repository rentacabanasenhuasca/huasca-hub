import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import RulesManager from './RulesManager'

export default async function ReglasPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('id, name, min_nights, max_nights, price_override_mxn, price_adjustment_pct, extra_guest_fee_mxn, allowed_arrival_days, priority, color')
    .eq('host_id', host.id)
    .order('priority', { ascending: false })

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('host_id', host.id)
    .order('name')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Reglas de precio</h1>
        <p className="text-sm text-stone mt-1">
          Crea reglas reutilizables (temporada alta, mínimo de noches para un puente…) y aplícalas
          a las fechas que quieras desde el{' '}
          <a href="/admin/calendario" className="text-gold underline underline-offset-2">
            calendario
          </a>
          .
        </p>
      </div>
      <RulesManager rules={rules ?? []} properties={properties ?? []} />
    </div>
  )
}
