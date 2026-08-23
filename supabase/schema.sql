-- ============================================================
-- SCHEMA CONSOLIDADO — Cooperadora Escolar Aristides Bratti
-- Correr en orden en el SQL Editor de Supabase para levantar
-- una base limpia desde cero.
--
-- Si ya tenés la base levantada con datos, NO corras este script
-- de cabo a rabo: las sentencias DROP/DELETE borran todo.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLAS BASE
-- ─────────────────────────────────────────────────────────────

-- Pagadores (titulares que pagan: padres / tutores)
create table if not exists pagadores (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  dni                   text,
  telefono              text,
  mail                  text unique,                -- opcional (aportantes sin login)
  notas                 text,                       -- gestión interna del directivo
  ultimo_aviso_mensual  date,                       -- anti-spam recordatorio (cron diario)
  ultimo_aviso_deuda    date,                       -- anti-spam alerta morosidad (cron diario)
  created_at            timestamptz default now()
);

-- DNI único entre pagadores que sí lo tienen cargado (parcial index).
-- Permite NULLs múltiples para registros viejos sin DNI cargado.
create unique index if not exists pagadores_dni_unique
  on pagadores (dni)
  where dni is not null;

-- Alumnos
create table if not exists alumnos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  grado       text not null,
  turno       text,                          -- 'Mañana' | 'Noche'
  pagador_id  uuid references pagadores(id),
  activo      boolean default true,
  notas       text,                          -- gestión interna del directivo
  created_at  timestamptz default now()
);

-- Planes
-- precio_por_mes es GENERATED (calculado automáticamente).
-- Para cambiar el precio, editar monto_total y/o cantidad_meses.
create table if not exists planes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  monto_total     integer not null,                 -- pesos enteros
  cantidad_meses  int not null,
  precio_por_mes  integer generated always as (
    round(monto_total::numeric / cantidad_meses)::integer
  ) stored,
  turno           text not null default 'diurno',  -- 'diurno' | 'nocturno'
  tipo            text not null default 'mensual'  -- 'mensual' | 'anual'
);

-- Suscripciones (un plan asignado a un alumno)
create table if not exists suscripciones (
  id                 uuid primary key default gen_random_uuid(),
  alumno_id          uuid references alumnos(id),
  plan_id            uuid references planes(id),
  fecha_inicio       date not null,
  estado             text default 'activa',         -- 'activa' | 'pendiente' | 'cancelada'
  metodo_pago        text default 'efectivo',       -- 'efectivo' | 'mercadopago'
  tipo_pago          text not null default 'manual',-- 'manual' | 'suscripcion' | 'anual'
  mp_preapproval_id  text,
  mp_status          text default 'pending',
  created_at         timestamptz default now()
);

-- Cuotas (una fila por mes por alumno) → en la UI se llaman "aportes"
create table if not exists cuotas (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid references alumnos(id),
  suscripcion_id  uuid references suscripciones(id),
  mes             int not null,
  año             int not null,
  monto           integer not null,                  -- pesos enteros
  estado          text default 'pendiente',          -- 'pendiente' | 'pagada' | 'vencida'
  created_at      timestamptz default now(),
  unique(alumno_id, mes, año)
);

-- Pagos (cobros recibidos)
create table if not exists pagos (
  id                  uuid primary key default gen_random_uuid(),
  pagador_id          uuid references pagadores(id),
  monto               integer not null,              -- pesos enteros
  descuento           integer default 0,              -- pesos enteros
  fecha               date not null,
  metodo              text not null,                  -- 'efectivo' | 'mercadopago' | 'transferencia'
  referencia_externa  text,                            -- id de pago de MP
  registrado_por      text,                            -- 'admin' | 'webhook_mp'
  notas               text,
  -- Anulación (soft delete con auditoría)
  anulado             boolean not null default false,
  motivo_anulacion    text,
  anulado_at          timestamptz,
  anulado_por         text,
  created_at          timestamptz default now()
);

-- Tabla puente pago ↔ cuotas (un pago puede saldar varias cuotas)
create table if not exists pagos_cuotas (
  id        uuid primary key default gen_random_uuid(),
  pago_id   uuid references pagos(id) on delete cascade,
  cuota_id  uuid references cuotas(id) on delete cascade,
  unique(pago_id, cuota_id)
);

-- Configuración general (clave/valor)
create table if not exists configuracion (
  clave text primary key,
  valor text not null
);

-- ─────────────────────────────────────────────────────────────
-- 2. DATOS INICIALES
-- ─────────────────────────────────────────────────────────────

-- Configuración por defecto
insert into configuracion(clave, valor) values
  ('meses_alerta_deuda',           '3'),  -- umbral para alerta de morosidad (cron diario)
  ('descuento_maximo_porcentaje',  '20'),
  ('dia_vencimiento',              '10'),
  ('monto_cuota_diurno',           '1000'),
  ('monto_cuota_nocturno',         '1500')
on conflict (clave) do nothing;

-- Planes por defecto (4 planes)
-- Solo los inserta si la tabla está vacía
insert into planes (nombre, monto_total, cantidad_meses, turno, tipo)
select * from (values
  ('Mensual Diurno',    1000::numeric,  1,  'diurno',   'mensual'),
  ('Anual Diurno',     11000::numeric, 12,  'diurno',   'anual'),
  ('Mensual Nocturno',  1500::numeric,  1,  'nocturno', 'mensual'),
  ('Anual Nocturno',   13500::numeric, 12,  'nocturno', 'anual')
) as v(nombre, monto_total, cantidad_meses, turno, tipo)
where not exists (select 1 from planes);

-- ─────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
-- Política general:
--   • Datos de referencia (planes, configuracion) → SELECT autenticados.
--   • Datos privados → un pagador solo ve su propia info, vinculada
--     vía pagadores.mail = auth.email().
--   • Las escrituras pasan SIEMPRE por Server Actions con service_role
--     (bypassa RLS), por eso no hay políticas INSERT/UPDATE/DELETE.

alter table pagadores      enable row level security;
alter table alumnos        enable row level security;
alter table suscripciones  enable row level security;
alter table cuotas         enable row level security;
alter table pagos          enable row level security;
alter table pagos_cuotas   enable row level security;
alter table planes         enable row level security;
alter table configuracion  enable row level security;

-- Lectura pública (autenticada) de datos no sensibles
drop policy if exists "planes_lectura_autenticados"        on planes;
drop policy if exists "configuracion_lectura_autenticados" on configuracion;

create policy "planes_lectura_autenticados"
  on planes for select to authenticated using (true);

create policy "configuracion_lectura_autenticados"
  on configuracion for select to authenticated using (true);

-- Pagador solo ve su propia fila
drop policy if exists "pagadores_select_propio" on pagadores;
create policy "pagadores_select_propio"
  on pagadores for select to authenticated
  using (mail = auth.email());

-- Alumnos del pagador
drop policy if exists "alumnos_select_del_pagador" on alumnos;
create policy "alumnos_select_del_pagador"
  on alumnos for select to authenticated
  using (
    pagador_id in (select id from pagadores where mail = auth.email())
  );

-- Suscripciones de los alumnos del pagador
drop policy if exists "suscripciones_select_del_pagador" on suscripciones;
create policy "suscripciones_select_del_pagador"
  on suscripciones for select to authenticated
  using (
    alumno_id in (
      select a.id from alumnos a
      join pagadores p on p.id = a.pagador_id
      where p.mail = auth.email()
    )
  );

-- Cuotas de los alumnos del pagador
drop policy if exists "cuotas_select_del_pagador" on cuotas;
create policy "cuotas_select_del_pagador"
  on cuotas for select to authenticated
  using (
    alumno_id in (
      select a.id from alumnos a
      join pagadores p on p.id = a.pagador_id
      where p.mail = auth.email()
    )
  );

-- Pagos del pagador
drop policy if exists "pagos_select_del_pagador" on pagos;
create policy "pagos_select_del_pagador"
  on pagos for select to authenticated
  using (
    pagador_id in (select id from pagadores where mail = auth.email())
  );

-- Pagos↔cuotas del pagador
drop policy if exists "pagos_cuotas_select_del_pagador" on pagos_cuotas;
create policy "pagos_cuotas_select_del_pagador"
  on pagos_cuotas for select to authenticated
  using (
    pago_id in (
      select p.id from pagos p
      join pagadores pg on pg.id = p.pagador_id
      where pg.mail = auth.email()
    )
  );

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
