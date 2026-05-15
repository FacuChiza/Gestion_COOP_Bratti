-- ════════════════════════════════════════════════════════════════════════
-- Migración 05 — Montos siempre enteros (sin decimales)
-- ════════════════════════════════════════════════════════════════════════
-- Por qué:
--  La cooperadora maneja pesos argentinos en valores cerrados ($1000,
--  $1500, $4500). No tiene sentido guardar 1000.0000000000 ni mostrarlo
--  así en el SQL Editor / exports. Los planes mensuales se calculaban
--  como monto_total/cantidad_meses lo que generaba decimales basura.
--
-- Cambios:
--   • cuotas.monto       : numeric → integer (redondeado)
--   • pagos.monto        : numeric → integer
--   • pagos.descuento    : numeric → integer
--   • planes.monto_total : numeric → integer
--   • planes.precio_por_mes : sigue GENERATED, ahora como integer
--                             (división entera con redondeo).
--
-- IMPORTANTE: Como precio_por_mes es GENERATED STORED, hay que dropear
-- y recrear la columna. Si hay datos existentes los redondea a entero.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Cuotas
alter table cuotas
  alter column monto type integer using round(monto)::integer;

-- 2. Pagos
alter table pagos
  alter column monto     type integer using round(monto)::integer,
  alter column descuento type integer using round(descuento)::integer;

-- 3. Planes — recrear precio_por_mes como GENERATED integer
alter table planes drop column if exists precio_por_mes;

alter table planes
  alter column monto_total type integer using round(monto_total)::integer;

alter table planes
  add column precio_por_mes integer generated always as (
    round(monto_total::numeric / cantidad_meses)::integer
  ) stored;
