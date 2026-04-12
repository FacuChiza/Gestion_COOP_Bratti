-- ============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
alter table pagadores        enable row level security;
alter table alumnos          enable row level security;
alter table suscripciones    enable row level security;
alter table cuotas           enable row level security;
alter table pagos            enable row level security;
alter table pagos_cuotas     enable row level security;
alter table planes           enable row level security;
alter table configuracion    enable row level security;

-- ============================================================
-- PLANES Y CONFIGURACION: lectura para cualquier autenticado
-- (son datos de referencia, no sensibles)
-- ============================================================
create policy "planes_lectura_autenticados"
  on planes for select
  to authenticated
  using (true);

create policy "configuracion_lectura_autenticados"
  on configuracion for select
  to authenticated
  using (true);

-- ============================================================
-- PAGADORES: un pagador solo ve su propia fila
-- ============================================================
create policy "pagadores_select_propio"
  on pagadores for select
  to authenticated
  using (mail = auth.email());

-- ============================================================
-- ALUMNOS: solo los alumnos del pagador logueado
-- ============================================================
create policy "alumnos_select_del_pagador"
  on alumnos for select
  to authenticated
  using (
    pagador_id in (
      select id from pagadores where mail = auth.email()
    )
  );

-- ============================================================
-- SUSCRIPCIONES: solo las de los alumnos del pagador logueado
-- ============================================================
create policy "suscripciones_select_del_pagador"
  on suscripciones for select
  to authenticated
  using (
    alumno_id in (
      select a.id from alumnos a
      join pagadores p on p.id = a.pagador_id
      where p.mail = auth.email()
    )
  );

-- ============================================================
-- CUOTAS: solo las de los alumnos del pagador logueado
-- ============================================================
create policy "cuotas_select_del_pagador"
  on cuotas for select
  to authenticated
  using (
    alumno_id in (
      select a.id from alumnos a
      join pagadores p on p.id = a.pagador_id
      where p.mail = auth.email()
    )
  );

-- ============================================================
-- PAGOS: solo los pagos del pagador logueado
-- ============================================================
create policy "pagos_select_del_pagador"
  on pagos for select
  to authenticated
  using (
    pagador_id in (
      select id from pagadores where mail = auth.email()
    )
  );

-- ============================================================
-- PAGOS_CUOTAS: solo los que corresponden a pagos del pagador
-- ============================================================
create policy "pagos_cuotas_select_del_pagador"
  on pagos_cuotas for select
  to authenticated
  using (
    pago_id in (
      select p.id from pagos p
      join pagadores pg on pg.id = p.pagador_id
      where pg.mail = auth.email()
    )
  );

-- ============================================================
-- NOTA: el panel /admin usa la service_role_key que bypasea
-- RLS por completo, así que no necesita políticas de escritura.
-- ============================================================
