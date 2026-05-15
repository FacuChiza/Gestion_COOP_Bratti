-- ============================================================
-- MIGRACIÓN 02: Admin avanzado
-- Agrega columnas para edición operativa por directivos
-- (anulación de pagos, notas internas, etc.)
-- ============================================================

-- Soft delete de pagos (auditable, no se borra de la base)
alter table pagos
  add column if not exists anulado          boolean      not null default false,
  add column if not exists motivo_anulacion text,
  add column if not exists anulado_at       timestamptz,
  add column if not exists anulado_por      text;

-- Notas internas (la cooperadora puede registrar gestiones)
alter table alumnos
  add column if not exists notas text;

alter table pagadores
  add column if not exists notas text;

-- Datos extra de configuración (si no existían ya)
insert into configuracion(clave, valor) values
  ('descuento_maximo_porcentaje', '20'),
  ('dia_vencimiento',             '10'),
  ('meses_alerta_deuda',          '4')
on conflict (clave) do nothing;
