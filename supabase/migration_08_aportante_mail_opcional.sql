-- ════════════════════════════════════════════════════════════════════════
-- Migración 08 — Email del aportante opcional
-- ════════════════════════════════════════════════════════════════════════
-- En el modelo nuevo los aportantes NO tienen login (todo es por /pagar con
-- el DNI del alumno). El email pasa a ser opcional: sirve para el recibo,
-- pero el canal principal es WhatsApp. Muchos aportantes se cargan desde el
-- padrón sin email.
--
-- El índice UNIQUE se mantiene: en Postgres varios NULL no colisionan, así
-- que se sigue evitando duplicar un mismo email real.
-- ════════════════════════════════════════════════════════════════════════

alter table pagadores alter column mail drop not null;
