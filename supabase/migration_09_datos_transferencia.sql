-- ════════════════════════════════════════════════════════════════════════
-- Migración 09 — Datos de transferencia + más métodos de pago
-- ════════════════════════════════════════════════════════════════════════
-- Permite recibir aportes por transferencia directa a la cuenta de la
-- cooperadora (sin comisión de Mercado Pago). Los datos se muestran en
-- /pagar si están cargados, y son editables desde el panel (Parámetros).
--
-- Los pagos manuales (efectivo, transferencia, MODO, otro) los registra la
-- dirección desde el panel; `pagos.metodo` es texto libre, así que no hace
-- falta cambiar el schema para los métodos nuevos.
-- ════════════════════════════════════════════════════════════════════════

insert into configuracion (clave, valor) values
  ('transferencia_alias',   ''),
  ('transferencia_cbu',     ''),
  ('transferencia_titular', ''),
  ('transferencia_banco',   '')
on conflict (clave) do nothing;
