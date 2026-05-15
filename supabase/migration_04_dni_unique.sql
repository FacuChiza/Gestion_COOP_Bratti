-- ════════════════════════════════════════════════════════════════════════
-- Migración 04 — DNI único en pagadores + index para búsqueda rápida
-- ════════════════════════════════════════════════════════════════════════
-- Por qué:
--  El registro web ahora pide DNI obligatorio y normalizado (solo dígitos).
--  La página /pagar pública lo usa como identificador de búsqueda.
--  Necesitamos garantizar que no haya 2 pagadores con el mismo DNI y que
--  la búsqueda sea instantánea.
--
--  El UNIQUE permite NULLs múltiples (Postgres por defecto), así que los
--  registros viejos que tengan dni = NULL no rompen la migración.
-- ════════════════════════════════════════════════════════════════════════

-- Index único parcial: solo aplica cuando dni IS NOT NULL.
-- Así los registros viejos con dni en NULL pueden coexistir.
create unique index if not exists pagadores_dni_unique
  on pagadores (dni)
  where dni is not null;
