/**
 * Webhook de MercadoPago
 * MP llama a esta URL cada vez que hay un evento de pago o suscripción.
 * Configurarlo en: mercadopago.com → Tus integraciones → Webhooks
 * URL: https://tu-dominio.vercel.app/api/webhooks/mp
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspConfirmacionPago, wspDebitoAutomatico } from '@/lib/twilio'
import { enviarRecibo } from '@/lib/email'
import { formatMes } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body

    if (!['payment', 'preapproval'].includes(type)) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()

    // ────────────────────────────────────────────────────────────
    // PAGO ÚNICO APROBADO (manual, anual o consolidado)
    // ────────────────────────────────────────────────────────────
    if (type === 'payment') {
      const paymentId = data?.id
      if (!paymentId) return NextResponse.json({ ok: true })

      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
      )
      if (!mpRes.ok) return NextResponse.json({ ok: true })
      const pago = await mpRes.json()
      if (pago.status !== 'approved') return NextResponse.json({ ok: true })

      const colonIdx  = (pago.external_reference ?? '').indexOf(':')
      const tipo      = colonIdx >= 0 ? pago.external_reference.slice(0, colonIdx) : ''
      const referencia = colonIdx >= 0 ? pago.external_reference.slice(colonIdx + 1) : ''

      // ── Pago consolidado: todos los alumnos del pagador ──────
      if (tipo === 'pagador') {
        const { data: alumnos } = await supabase
          .from('alumnos')
          .select('id, nombre')
          .eq('pagador_id', referencia)
          .eq('activo', true)

        if (!alumnos?.length) return NextResponse.json({ ok: true })

        const alumnoIds = alumnos.map((a: { id: string }) => a.id)

        type CuotaRow = { id: string; mes: number; año: number; monto: number }
        const { data: rawCuotas } = await supabase
          .from('cuotas')
          .select('*')
          .in('alumno_id', alumnoIds)
          .in('estado', ['pendiente', 'vencida'])
        const cuotas = rawCuotas as unknown as CuotaRow[] | null

        if (!cuotas?.length) return NextResponse.json({ ok: true })

        const cuotaIds   = cuotas.map(c => c.id)
        const montoTotal = cuotas.reduce((acc, c) => acc + c.monto, 0)

        await supabase.from('cuotas').update({ estado: 'pagada' }).in('id', cuotaIds)
        await supabase.from('pagos').insert({
          pagador_id: referencia, monto: montoTotal, descuento: 0,
          fecha: new Date().toISOString().split('T')[0],
          metodo: 'mercadopago', referencia_externa: String(paymentId), registrado_por: 'webhook_mp',
        })

        const { data: pagadorData } = await supabase
          .from('pagadores')
          .select('nombre, telefono, mail')
          .eq('id', referencia)
          .single()

        if (pagadorData) {
          const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())
          const alumnosNombres = (alumnos as { nombre: string }[]).map(a => a.nombre)

          // WhatsApp
          await wspConfirmacionPago({
            telefono: pagadorData.telefono,
            nombrePagador: pagadorData.nombre.split(' ')[0],
            nombreAlumno: `${alumnos.length} estudiante${alumnos.length > 1 ? 's' : ''}`,
            mes: mesNombre,
            monto: montoTotal,
          })

          // Email con recibo
          await enviarRecibo({
            mail: pagadorData.mail,
            nombrePagador: pagadorData.nombre,
            nombreAlumno: alumnosNombres,
            cuotas: cuotas.map(c => ({
              mes: formatMes(c.mes, c.año),
              monto: c.monto,
            })),
            montoTotal,
            metodoPago: 'mercadopago',
            nroRecibo: String(paymentId),
          })
        }
      }

      // ── Pago individual por suscripción (manual / anual) ─────
      if (tipo === 'manual' || tipo === 'anual') {
        type AlumnoData = { nombre: string; pagadores: { id: string; nombre: string; telefono: string; mail: string } | null }
        type CuotaConAlumno = { id: string; mes: number; año: number; monto: number; alumnos: AlumnoData }

        const { data: rawCuotas } = await supabase
          .from('cuotas')
          .select('*, alumnos(nombre, pagadores(id, nombre, telefono, mail))')
          .eq('suscripcion_id', referencia)
          .in('estado', ['pendiente', 'vencida'])
        const cuotas = rawCuotas as unknown as CuotaConAlumno[] | null

        if (!cuotas?.length) return NextResponse.json({ ok: true })

        const cuotaIds   = cuotas.map(c => c.id)
        const montoTotal = cuotas.reduce((acc, c) => acc + c.monto, 0)

        await supabase.from('cuotas').update({ estado: 'pagada' }).in('id', cuotaIds)

        const alumno = cuotas[0].alumnos

        if (alumno?.pagadores) {
          await supabase.from('pagos').insert({
            pagador_id: alumno.pagadores.id, monto: montoTotal, descuento: 0,
            fecha: new Date().toISOString().split('T')[0],
            metodo: 'mercadopago', referencia_externa: String(paymentId), registrado_por: 'webhook_mp',
          })

          const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())

          // WhatsApp
          await wspConfirmacionPago({
            telefono: alumno.pagadores.telefono,
            nombrePagador: alumno.pagadores.nombre.split(' ')[0],
            nombreAlumno: alumno.nombre,
            mes: mesNombre,
            monto: montoTotal,
          })

          // Email con recibo
          await enviarRecibo({
            mail: alumno.pagadores.mail,
            nombrePagador: alumno.pagadores.nombre,
            nombreAlumno: alumno.nombre,
            cuotas: cuotas.map(c => ({
              mes: formatMes(c.mes, c.año),
              monto: c.monto,
            })),
            montoTotal,
            metodoPago: 'mercadopago',
            nroRecibo: String(paymentId),
          })
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // DÉBITO AUTOMÁTICO (preapproval / suscripción mensual)
    // ────────────────────────────────────────────────────────────
    if (type === 'preapproval') {
      const preapprovalId = data?.id
      if (!preapprovalId) return NextResponse.json({ ok: true })

      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
      )
      if (!mpRes.ok) return NextResponse.json({ ok: true })
      const preapproval = await mpRes.json()

      // Activar suscripción cuando el usuario aprueba en MP
      if (preapproval.status === 'authorized') {
        await supabase
          .from('suscripciones')
          .update({ estado: 'activa', mp_status: 'activa', mp_preapproval_id: preapprovalId })
          .eq('mp_preapproval_id', preapprovalId)
      }

      // Cobro mensual automático ejecutado por MP
      if (preapproval.status === 'authorized' && body.action === 'payment.created') {
        const { data: suscripcion } = await supabase
          .from('suscripciones')
          .select('*, alumno_id, alumnos(nombre, pagadores(nombre, telefono, mail)), planes(precio_por_mes, nombre)')
          .eq('mp_preapproval_id', preapprovalId)
          .single()

        if (suscripcion) {
          const ahora  = new Date()
          const mesNum = ahora.getMonth() + 1
          const año    = ahora.getFullYear()

          // Marcar cuota del mes como pagada
          await supabase
            .from('cuotas')
            .update({ estado: 'pagada' })
            .eq('alumno_id', suscripcion.alumno_id)
            .eq('mes', mesNum)
            .eq('año', año)

          type AlumnoSusc = { nombre: string; pagadores: { nombre: string; telefono: string; mail: string } | null }
          const alumno = suscripcion.alumnos as AlumnoSusc | null
          const monto  = suscripcion.planes?.precio_por_mes ?? 0

          if (alumno?.pagadores) {
            const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(ahora)

            // WhatsApp débito automático
            await wspDebitoAutomatico({
              telefono: alumno.pagadores.telefono,
              nombrePagador: alumno.pagadores.nombre.split(' ')[0],
              nombreAlumno: alumno.nombre,
              mes: mesNombre,
              monto,
            })

            // Email recibo débito automático
            await enviarRecibo({
              mail: alumno.pagadores.mail,
              nombrePagador: alumno.pagadores.nombre,
              nombreAlumno: alumno.nombre,
              cuotas: [{ mes: formatMes(mesNum, año), monto }],
              montoTotal: monto,
              metodoPago: 'mercadopago',
              nroRecibo: `DB-${preapprovalId}-${año}${String(mesNum).padStart(2, '0')}`,
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
