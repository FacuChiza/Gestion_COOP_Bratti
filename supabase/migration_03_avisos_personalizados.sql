-- ════════════════════════════════════════════════════════════════════════
-- Migración 03 — Avisos personalizados por pagador (cron diario)
-- ════════════════════════════════════════════════════════════════════════
-- Lo que cambia el flujo de notificaciones:
--
-- Antes: el cron mensual del día 1 le mandaba a TODOS los pagadores con
-- deuda. Resultado: muchos avisos juntos para gente que recién había
-- pagado el día 28 del mes anterior.
--
-- Ahora: un cron diario corre todos los días a las 9 AM (Argentina) y
-- recorre cada pagador. Manda hasta 2 tipos de aviso, cada uno con su
-- propia cadencia, y se anti-spamea con dos campos nuevos en `pagadores`:
--
--   • ultimo_aviso_mensual → fecha del último recordatorio amable
--     "Pasó un mes desde tu último aporte". Solo se reenvía cuando han
--     pasado >= 30 días desde el último pago Y desde el último aviso.
--
--   • ultimo_aviso_deuda → fecha de la última alerta de morosidad
--     "Tenés N aportes acumulados". Solo una vez por mes calendario,
--     cuando cuotas_deuda >= meses_alerta_deuda (default 3).
--
-- Los pagadores con débito automático activo NO reciben ninguno de los dos
-- (MP les cobra solo, sería molestar al pedo).
-- ════════════════════════════════════════════════════════════════════════

alter table pagadores
  add column if not exists ultimo_aviso_mensual date,
  add column if not exists ultimo_aviso_deuda   date;

-- Bajar el default de meses_alerta_deuda de 4 a 3.
-- Solo lo cambiamos si la fila existe y nadie lo tocó manualmente.
update configuracion
   set valor = '3'
 where clave = 'meses_alerta_deuda'
   and valor = '4';

insert into configuracion (clave, valor)
values ('meses_alerta_deuda', '3')
on conflict (clave) do nothing;
