-- ════════════════════════════════════════════════════════════════════════
-- Migración 07 — Padrón anual + modelo de precios nuevo
-- ════════════════════════════════════════════════════════════════════════
-- Contexto: se rediseña el flujo del padre alrededor del PADRÓN de alumnos
-- que provee la escuela (alumno + curso + DNI). El alumno pasa a ser el
-- punto de entrada, y el modelo maneja el ciclo lectivo año a año.
--
-- Precios nuevos (editables por los directivos desde el panel):
--   • aporte_mensual  = 10000  ($ por alumno por mes)
--   • aporte_hermanos = 8000   ($ por alumno cuando la familia tiene 2+)
--   • aporte_anual    = 100000 ($ ciclo lectivo completo)
-- ════════════════════════════════════════════════════════════════════════

-- ── Alumnos: DNI (para matcheo entre años y búsqueda del padre) ──────────
--    + ciclo lectivo + estado del lifecycle (activo | egresado | baja)
alter table alumnos
  add column if not exists dni           text,
  add column if not exists ciclo_lectivo int,
  add column if not exists estado        text not null default 'activo';

-- DNI único cuando está presente (evita duplicados al reimportar el padrón)
create unique index if not exists alumnos_dni_unique
  on alumnos(dni) where dni is not null;

create index if not exists idx_alumnos_estado        on alumnos(estado);
create index if not exists idx_alumnos_ciclo_lectivo on alumnos(ciclo_lectivo);

-- Sembrar ciclo lectivo actual en los alumnos existentes
update alumnos
   set ciclo_lectivo = extract(year from now())::int
 where ciclo_lectivo is null;

-- Mantener estado coherente con el flag activo existente
update alumnos set estado = 'baja' where activo = false and estado = 'activo';

-- ── Precios como parámetros editables ───────────────────────────────────
insert into configuracion (clave, valor) values
  ('aporte_mensual',  '10000'),
  ('aporte_hermanos', '8000'),
  ('aporte_anual',    '100000')
on conflict (clave) do nothing;

-- ── Alinear los planes existentes al modelo nuevo ───────────────────────
-- (Ya no hay distinción de precio por turno; el descuento por hermanos se
--  calcula en la app según la cantidad de alumnos activos del pagador.)
update planes set monto_total = 10000  where tipo = 'mensual';
update planes set monto_total = 100000 where tipo = 'anual';
