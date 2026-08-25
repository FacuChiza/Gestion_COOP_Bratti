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
    // MP manda distintos formatos según el evento configurado en el panel:
    //   • "Pagos" (moderno):        { type: 'payment', data: { id } }
    //   • "Pagos (legacy)" / IPN:   ?topic=payment&id=...  o  { topic, resource }
    //   • "Planes y suscripciones": { type: 'subscription_preapproval' | 'subscription_authorized_payment', data:{ id } }
    //   • preapproval (viejo):      { type: 'preapproval', data:{ id } }
    // Normalizamos todo para no depender del formato exacto.
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { body = {} }

    const qs        = req.nextUrl.searchParams
    const qsTopic   = qs.get('topic') || qs.get('type') || ''
    const qsId      = qs.get('id') || qs.get('data.id') || ''
    const bodyData  = (body.data ?? {}) as { id?: string | number }
    const resource  = typeof body.resource === 'string' ? body.resource : ''

    const rawType = String(body.type ?? body.topic ?? qsTopic ?? '').toLowerCase()
    const dataIdRaw = bodyData.id ?? qsId ?? (resource ? resource.split('/').pop() : undefined)
    const dataId: string | undefined = dataIdRaw != null && dataIdRaw !== '' ? String(dataIdRaw) : undefined

    const esSuscripcion = rawType.includes('subscription') || rawType.includes('preapproval')
    const esPago        = !esSuscripcion && rawType.includes('payment')

    if (!esPago && !esSuscripcion) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()

    // ────────────────────────────────────────────────────────────
    // PAGO ÚNICO APROBADO (manual, anual o consolidado)
    // ────────────────────────────────────────────────────────────
    if (esPago) {
      const paymentId = dataId
      if (!paymentId) return NextResponse.json({ ok: true })

      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
      )
      if (!mpRes.ok) return NextResponse.json({ ok: true })
      const pago = await mpRes.json()
      if (pago.status !== 'approved') return NextResponse.json({ ok: true })

      // Idempotencia: MP reintenta las notificaciones. Si ya registramos un
      // pago con este payment id, no lo procesamos de nuevo (evita duplicar
      // el aporte y contar la plata dos veces).
      const { data: yaRegistrado } = await supabase
        .from('pagos').select('id').eq('referencia_externa', String(paymentId)).maybeSingle()
      if (yaRegistrado) return NextResponse.json({ ok: true, duplicate: true })

      const colonIdx  = (pago.external_reference ?? '').indexOf(':')
      const tipo      = colonIdx >= 0 ? pago.external_reference.slice(0, colonIdx) : ''
      const referencia = colonIdx >= 0 ? pago.external_reference.slice(colonIdx + 1) : ''

      // ── Aporte mensual de un alumno (flujo padrón, sin registro previo) ──
      // Referencia: am:{alumnoId}. El pagador se resuelve/crea desde el
      // email que el padre usó en el checkout de MercadoPago.
      // 'av' = aporte de monto libre: se registra igual, pero la cuota del mes
      // solo se salda si lo aportado alcanza a cubrirla.
      if (tipo === 'am' || tipo === 'av') {
        const alumnoId = referencia
        const payerEmail = String(pago.payer?.email ?? '').toLowerCase()
        const payerNombre =
          [pago.payer?.first_name, pago.payer?.last_name].filter(Boolean).join(' ').trim() ||
          (payerEmail ? payerEmail.split('@')[0] : 'Pagador')
        const montoPagado = Math.round(pago.transaction_amount ?? 0)

        const { data: alumno } = await supabase
          .from('alumnos').select('id, nombre, pagador_id').eq('id', alumnoId).maybeSingle()
        if (!alumno) return NextResponse.json({ ok: true })

        // 1. Resolver / crear el pagador desde el email de MP
        let pagadorId: string | null = alumno.pagador_id
        if (payerEmail) {
          const { data: existente } = await supabase
            .from('pagadores').select('id').eq('mail', payerEmail).maybeSingle()
          if (existente) {
            pagadorId = existente.id
          } else {
            const { data: nuevo } = await supabase
              .from('pagadores').insert({ nombre: payerNombre, mail: payerEmail }).select('id').single()
            if (nuevo) pagadorId = nuevo.id
          }
          if (pagadorId && alumno.pagador_id !== pagadorId) {
            await supabase.from('alumnos').update({ pagador_id: pagadorId }).eq('id', alumnoId)
          }
        }

        // 2. Asegurar la cuota del mes actual y marcarla pagada
        const ahora = new Date()
        const mesNum = ahora.getMonth() + 1
        const anio = ahora.getFullYear()
        let cuotaId: string | null = null
        const { data: cuotaExistente } = await supabase
          .from('cuotas').select('id, monto').eq('alumno_id', alumnoId).eq('mes', mesNum).eq('año', anio).maybeSingle()
        if (cuotaExistente) {
          // En monto libre, solo saldamos si lo aportado cubre la cuota.
          const alcanza = tipo === 'am' || montoPagado >= (cuotaExistente.monto ?? 0)
          if (alcanza) {
            cuotaId = cuotaExistente.id
            await supabase.from('cuotas').update({ estado: 'pagada' }).eq('id', cuotaExistente.id)
          }
        } else if (tipo === 'am') {
          const { data: nuevaCuota } = await supabase
            .from('cuotas')
            .insert({ alumno_id: alumnoId, mes: mesNum, año: anio, monto: montoPagado, estado: 'pagada' })
            .select('id').single()
          if (nuevaCuota) cuotaId = nuevaCuota.id
        }

        // 3. Registrar el pago + trazabilidad + notificaciones
        if (pagadorId) {
          const { data: pagoCreado } = await supabase
            .from('pagos').insert({
              pagador_id: pagadorId, monto: montoPagado, descuento: 0,
              fecha: ahora.toISOString().split('T')[0],
              metodo: 'mercadopago', referencia_externa: String(paymentId), registrado_por: 'webhook_mp',
              notas: tipo === 'av' ? 'Aporte voluntario (monto libre)' : null,
            }).select('id').single()
          if (pagoCreado && cuotaId) {
            await supabase.from('pagos_cuotas').insert({ pago_id: pagoCreado.id, cuota_id: cuotaId })
          }
          const { data: pg } = await supabase
            .from('pagadores').select('nombre, telefono, mail').eq('id', pagadorId).single()
          if (pg) {
            const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(ahora)
            if (pg.telefono) {
              await wspConfirmacionPago({
                telefono: pg.telefono, nombrePagador: pg.nombre.split(' ')[0],
                nombreAlumno: alumno.nombre, mes: mesNombre, monto: montoPagado,
              })
            }
            if (pg.mail) {
              await enviarRecibo({
                mail: pg.mail, nombrePagador: pg.nombre, nombreAlumno: alumno.nombre,
                cuotas: [{ mes: formatMes(mesNum, anio), monto: montoPagado }],
                montoTotal: montoPagado, metodoPago: 'mercadopago',
                nroRecibo: String(paymentId), pagadorId,
              })
            }
          }
        }
        return NextResponse.json({ ok: true })
      }

      // ── Aporte anual de un alumno (pago único del ciclo lectivo) ──
      // Referencia: aa:{alumnoId}. Igual que 'am' pero cubre el año.
      if (tipo === 'aa') {
        const alumnoId = referencia
        const payerEmail = String(pago.payer?.email ?? '').toLowerCase()
        const payerNombre =
          [pago.payer?.first_name, pago.payer?.last_name].filter(Boolean).join(' ').trim() ||
          (payerEmail ? payerEmail.split('@')[0] : 'Pagador')
        const montoPagado = Math.round(pago.transaction_amount ?? 0)

        const { data: alumno } = await supabase
          .from('alumnos').select('id, nombre, pagador_id').eq('id', alumnoId).maybeSingle()
        if (!alumno) return NextResponse.json({ ok: true })

        // 1. Resolver / crear el pagador desde el email de MP
        let pagadorId: string | null = alumno.pagador_id
        if (payerEmail) {
          const { data: existente } = await supabase
            .from('pagadores').select('id').eq('mail', payerEmail).maybeSingle()
          if (existente) {
            pagadorId = existente.id
          } else {
            const { data: nuevo } = await supabase
              .from('pagadores').insert({ nombre: payerNombre, mail: payerEmail }).select('id').single()
            if (nuevo) pagadorId = nuevo.id
          }
          if (pagadorId && alumno.pagador_id !== pagadorId) {
            await supabase.from('alumnos').update({ pagador_id: pagadorId }).eq('id', alumnoId)
          }
        }

        // 2. Marcar como pagadas todas las cuotas pendientes del año; si no
        //    hay ninguna, asegurar la del mes actual.
        const ahora = new Date()
        const anio = ahora.getFullYear()
        const mesNum = ahora.getMonth() + 1
        const cuotaIds: string[] = []

        const { data: pendientesAnio } = await supabase
          .from('cuotas').select('id')
          .eq('alumno_id', alumnoId).eq('año', anio)
          .in('estado', ['pendiente', 'vencida'])
        if (pendientesAnio && pendientesAnio.length > 0) {
          for (const c of pendientesAnio) cuotaIds.push(c.id)
          await supabase.from('cuotas').update({ estado: 'pagada' }).in('id', cuotaIds)
        } else {
          const { data: cuotaMes } = await supabase
            .from('cuotas').select('id').eq('alumno_id', alumnoId).eq('mes', mesNum).eq('año', anio).maybeSingle()
          if (cuotaMes) {
            cuotaIds.push(cuotaMes.id)
            await supabase.from('cuotas').update({ estado: 'pagada' }).eq('id', cuotaMes.id)
          } else {
            const { data: nueva } = await supabase
              .from('cuotas')
              .insert({ alumno_id: alumnoId, mes: mesNum, año: anio, monto: montoPagado, estado: 'pagada' })
              .select('id').single()
            if (nueva) cuotaIds.push(nueva.id)
          }
        }

        // 3. Registrar el pago anual + trazabilidad + notificación
        if (pagadorId) {
          const { data: pagoCreado } = await supabase
            .from('pagos').insert({
              pagador_id: pagadorId, monto: montoPagado, descuento: 0,
              fecha: ahora.toISOString().split('T')[0],
              metodo: 'mercadopago', referencia_externa: String(paymentId),
              registrado_por: 'webhook_mp', notas: `Aporte anual ${anio}`,
            }).select('id').single()
          if (pagoCreado && cuotaIds.length > 0) {
            await supabase.from('pagos_cuotas').insert(
              cuotaIds.map((cid) => ({ pago_id: pagoCreado.id, cuota_id: cid }))
            )
          }
          const { data: pg } = await supabase
            .from('pagadores').select('nombre, telefono, mail').eq('id', pagadorId).single()
          if (pg?.mail) {
            await enviarRecibo({
              mail: pg.mail, nombrePagador: pg.nombre, nombreAlumno: alumno.nombre,
              cuotas: [{ mes: `Aporte anual ${anio}`, monto: montoPagado }],
              montoTotal: montoPagado, metodoPago: 'mercadopago',
              nroRecibo: String(paymentId), pagadorId,
            })
          }
        }
        return NextResponse.json({ ok: true })
      }

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

        // Crear pago y vincularlo con las cuotas saldadas (trazabilidad)
        const { data: pagoCreado } = await supabase
          .from('pagos')
          .insert({
            pagador_id: referencia, monto: montoTotal, descuento: 0,
            fecha: new Date().toISOString().split('T')[0],
            metodo: 'mercadopago', referencia_externa: String(paymentId), registrado_por: 'webhook_mp',
          })
          .select('id')
          .single()

        if (pagoCreado) {
          await supabase.from('pagos_cuotas').insert(
            cuotaIds.map((cuotaId) => ({ pago_id: pagoCreado.id, cuota_id: cuotaId }))
          )
        }

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
            pagadorId: referencia,
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
          // Crear pago y vincularlo con las cuotas saldadas
          const { data: pagoCreado } = await supabase
            .from('pagos')
            .insert({
              pagador_id: alumno.pagadores.id, monto: montoTotal, descuento: 0,
              fecha: new Date().toISOString().split('T')[0],
              metodo: 'mercadopago', referencia_externa: String(paymentId), registrado_por: 'webhook_mp',
            })
            .select('id')
            .single()

          if (pagoCreado) {
            await supabase.from('pagos_cuotas').insert(
              cuotaIds.map((cuotaId) => ({ pago_id: pagoCreado.id, cuota_id: cuotaId }))
            )
          }

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
            pagadorId: alumno.pagadores.id,
          })
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // DÉBITO AUTOMÁTICO (preapproval / suscripción mensual)
    // ────────────────────────────────────────────────────────────
    if (esSuscripcion) {
      const eventId = dataId
      if (!eventId) return NextResponse.json({ ok: true })

      // Las suscripciones se crean con la app de MP de "Suscripciones",
      // así que hay que consultarlas con ese token (no el de Checkout Pro).
      const subToken = process.env.MP_SUBSCRIPTION_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN

      // subscription_authorized_payment = cobro mensual recurrente.
      // subscription_preapproval / preapproval = alta/cambio de estado.
      const esCobroRecurrente = rawType.includes('authorized_payment')

      let preapprovalId: string | undefined

      if (esCobroRecurrente) {
        // El id es de un authorized_payment; resolvemos a qué suscripción pertenece.
        const apRes = await fetch(
          `https://api.mercadopago.com/authorized_payments/${eventId}`,
          { headers: { Authorization: `Bearer ${subToken}` } }
        )
        if (!apRes.ok) return NextResponse.json({ ok: true })
        const ap = await apRes.json()
        if (!['approved', 'processed'].includes(ap.status)) return NextResponse.json({ ok: true })
        preapprovalId = ap.preapproval_id
      } else {
        // El id ES el preapproval. Consultamos su estado.
        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${eventId}`,
          { headers: { Authorization: `Bearer ${subToken}` } }
        )
        if (!mpRes.ok) return NextResponse.json({ ok: true })
        const preapproval = await mpRes.json()
        preapprovalId = eventId

        // Activar la suscripción cuando el padre autoriza en MP
        if (preapproval.status === 'authorized') {
          await supabase
            .from('suscripciones')
            .update({ estado: 'activa', mp_status: 'activa', mp_preapproval_id: preapprovalId })
            .eq('mp_preapproval_id', preapprovalId)
        }
      }

      if (!preapprovalId) return NextResponse.json({ ok: true })

      // Cobro mensual automático ejecutado por MP
      if (esCobroRecurrente) {
        const { data: suscripcion } = await supabase
          .from('suscripciones')
          .select('*, alumno_id, alumnos(nombre, pagadores(id, nombre, telefono, mail)), planes(precio_por_mes, nombre)')
          .eq('mp_preapproval_id', preapprovalId)
          .single()

        if (suscripcion) {
          const ahora  = new Date()
          const mesNum = ahora.getMonth() + 1
          const año    = ahora.getFullYear()

          // Marcar cuota del mes como pagada y capturar su id para pagos_cuotas
          const { data: cuotaActualizada } = await supabase
            .from('cuotas')
            .update({ estado: 'pagada' })
            .eq('alumno_id', suscripcion.alumno_id)
            .eq('mes', mesNum)
            .eq('año', año)
            .select('id')
            .maybeSingle()

          type AlumnoSusc = { nombre: string; pagadores: { id: string; nombre: string; telefono: string; mail: string } | null }
          const alumno = suscripcion.alumnos as AlumnoSusc | null
          const monto  = suscripcion.planes?.precio_por_mes ?? 0

          const refDebito = `DB-${preapprovalId}-${año}${String(mesNum).padStart(2, '0')}`

          // Idempotencia: si ya registramos el débito de este mes, no duplicar.
          const { data: yaDebitado } = await supabase
            .from('pagos').select('id').eq('referencia_externa', refDebito).maybeSingle()
          if (yaDebitado) return NextResponse.json({ ok: true, duplicate: true })

          if (alumno?.pagadores) {
            // Registrar el pago automático en la tabla pagos
            const { data: pagoCreado } = await supabase
              .from('pagos')
              .insert({
                pagador_id: alumno.pagadores.id,
                monto,
                descuento: 0,
                fecha: ahora.toISOString().split('T')[0],
                metodo: 'mercadopago',
                referencia_externa: refDebito,
                registrado_por: 'webhook_mp',
                notas: 'Débito automático MP',
              })
              .select('id')
              .single()

            if (pagoCreado && cuotaActualizada) {
              await supabase.from('pagos_cuotas').insert({
                pago_id:  pagoCreado.id,
                cuota_id: cuotaActualizada.id,
              })
            }

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
              nroRecibo: refDebito,
              pagadorId: alumno.pagadores.id,
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
