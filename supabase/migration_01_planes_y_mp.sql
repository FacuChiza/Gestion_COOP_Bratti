-- ============================================================
-- MIGRACIÓN 01: Nuevos planes + columnas MP en suscripciones
-- Correr en Supabase → SQL Editor
-- ============================================================

-- 1. Agregar columnas a la tabla planes
alter table planes
  add column if not exists turno text not null default 'diurno',  -- 'diurno' | 'nocturno'
  add column if not exists tipo  text not null default 'mensual'; -- 'mensual' | 'anual'

-- 2. Limpiar planes anteriores y cargar los 4 planes reales
delete from planes;

insert into planes (id, nombre, monto_total, cantidad_meses, turno, tipo) values
  (gen_random_uuid(), 'Mensual Diurno',    1000,  1,  'diurno',   'mensual'),
  (gen_random_uuid(), 'Anual Diurno',      11000, 12, 'diurno',   'anual'),
  (gen_random_uuid(), 'Mensual Nocturno',  1500,  1,  'nocturno', 'mensual'),
  (gen_random_uuid(), 'Anual Nocturno',    13500, 12, 'nocturno', 'anual');

-- 3. Agregar columnas de MP y tipo de pago a suscripciones
alter table suscripciones
  add column if not exists mp_preapproval_id text,
  add column if not exists mp_status         text default 'pending',
  add column if not exists tipo_pago         text not null default 'manual';
  -- tipo_pago: 'suscripcion' (débito automático) | 'anual' (pago único) | 'manual' (paga cada mes)

-- 4. Actualizar configuracion con el monto de alerta
insert into configuracion values ('monto_cuota_diurno', '1000')
  on conflict (clave) do update set valor = excluded.valor;
insert into configuracion values ('monto_cuota_nocturno', '1500')
  on conflict (clave) do update set valor = excluded.valor;
