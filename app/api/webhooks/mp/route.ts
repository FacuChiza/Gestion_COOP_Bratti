/**
 * Webhook de MercadoPago
 * MP llama a esta URL cada vez que hay un evento de pago o suscripción.
 * Configurarlo en: mercadopago.com → Tus integraciones → Webhooks
 * URL: https://tu-dominio.vercel.app/api/webhooks/mp
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspConfirmacionPago, wspDebitoAutomatico } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body

    // Solo procesamos pagos aprobados y suscripciones autorizadas
    if (!['payment', 'preapproval'].includes(type)) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()

    // ── Pago único aprobado (anual o mensual manual) ──────────
    if (type === 'payment') {
      const paymentId = data?.id
      if (!paymentId) return NextResponse.json({ ok: true })

      // Consultar el pago a MP para obtener detalles
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        }
      )

      if (!mpRes.ok) return NextResponse.json({ ok: true })
      const pago = await mpRes.json()

      if (pago.status !== 'approved') return NextResponse.json({ ok: true })

      // external_reference tiene el formato "tipo:id"
      const [tipo, referencia] = (pago.external_reference ?? '').split(':')

      if (tipo === 'manual' || tipo === 'anual') {
        // Buscar cuota(s) por suscripcion_id o cuota_id
        const { data: cuotas } = await supabase
          .from('cuotas')
          .select('*, alumnos(nombre, pagadores(nombre, telefono))')
          .eq('suscripcion_id', referencia)
          .in('estado', ['pendiente', 'vencida'])

        if (cuotas && cuotas.length > 0) {
          const cuotaIds = cuotas.map((c: { id: string }) => c.id)
          const montoTotal = cuotas.reduce((acc: number, c: { monto: number }) => acc + c.monto, 0)

          // Marcar cuotas como pagadas
          await supabase
            .from('cuotas')
            .update({ estado: 'pagada' })
            .in('id', cuotaIds)

          // Registrar el pago en nuestra tabla
          const alumno = cuotas[0]?.alumnos as {
            nombre: string
            pagadores: { nombre: string; telefono: string; id: string } | null
          } | null

          if (alumno?.pagadores) {
            const { data: pagadorData } = await supabase
              .from('pagadores')
              .select('id')
              .eq('nombre', alumno.pagadores.nombre)
              .single()

            if (pagadorData) {
              await supabase.from('pagos').insert({
                pagador_id: pagadorData.id,
                monto: montoTotal,
                descuento: 0,
                fecha: new Date().toISOString().split('T')[0],
                metodo: 'mercadopago',
                referencia_externa: String(paymentId),
                registrado_por: 'webhook_mp',
              })
            }

            // WhatsApp de confirmación
            const mes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
              .format(new Date())

            await wspConfirmacionPago({
              telefono: alumno.pagadores.telefono,
              nombrePagador: alumno.pagadores.nombre.split(' ')[0],
              nombreAlumno: alumno.nombre,
              mes,
              monto: montoTotal,
            })
          }
        }
      }
    }

    // ── Suscripción autorizada o cobro automático ─────────────
    if (type === 'preapproval') {
      const preapprovalId = data?.id
      if (!preapprovalId) return NextResponse.json({ ok: true })

      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        {
          headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        }
      )

      if (!mpRes.ok) return NextResponse.json({ ok: true })
      const preapproval = await mpRes.json()

      if (preapproval.status === 'authorized') {
        // Activar la suscripción en nuestra DB
        await supabase
          .from('suscripciones')
          .update({ estado: 'activa', mp_status: 'activa', mp_preapproval_id: preapprovalId })
          .eq('mp_preapproval_id', preapprovalId)
      }

      // Cobro mensual ejecutado
      if (preapproval.status === 'authorized' && body.action === 'payment.created') {
        const { data: suscripcion } = await supabase
          .from('suscripciones')
          .select('*, alumnos(nombre, pagadores(nombre, telefono)), planes(precio_por_mes)')
          .eq('mp_preapproval_id', preapprovalId)
          .single()

        if (suscripcion) {
          const ahora = new Date()
          const mes = ahora.getMonth() + 1
          const año = ahora.getFullYear()

          // Marcar cuota del mes como pagada
          await supabase
            .from('cuotas')
            .update({ estado: 'pagada' })
            .eq('alumno_id', suscripcion.alumno_id)
            .eq('mes', mes)
            .eq('año', año)

          // WhatsApp de débito automático
          const alumno = suscripcion.alumnos as {
            nombre: string
            pagadores: { nombre: string; telefono: string } | null
          } | null

          if (alumno?.pagadores) {
            const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
              .format(ahora)

            await wspDebitoAutomatico({
              telefono: alumno.pagadores.telefono,
              nombrePagador: alumno.pagadores.nombre.split(' ')[0],
              nombreAlumno: alumno.nombre,
              mes: mesNombre,
              monto: suscripcion.planes?.precio_por_mes ?? 0,
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook/mp]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
