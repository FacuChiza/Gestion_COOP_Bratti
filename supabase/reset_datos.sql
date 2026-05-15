-- ════════════════════════════════════════════════════════════════════════
-- RESET DE DATOS — borra todos los pagadores, alumnos, suscripciones,
-- cuotas, pagos y usuarios de Supabase Auth, dejando la base limpia
-- pero conservando la estructura, los planes y la configuración.
-- ════════════════════════════════════════════════════════════════════════
-- ⚠️  CUIDADO: esto es DESTRUCTIVO. NO se puede deshacer.
--
-- Lo que NO toca:
--   • Tabla planes  (precios cargados)
--   • Tabla configuracion (parámetros operativos)
--   • Estructura del schema (tablas, índices, triggers, RLS)
--
-- Lo que borra:
--   • Todos los registros de pagos_cuotas, pagos, cuotas, suscripciones,
--     alumnos y pagadores
--   • Todos los usuarios de auth.users (login del padre se va)
--
-- Cómo correrlo:
--   1) Abrí SQL Editor en Supabase
--   2) Pegá todo este script
--   3) Click "Run". Te va a pedir confirmar porque borra.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. Borrar datos de las tablas operativas en orden (FK)
truncate table pagos_cuotas  restart identity cascade;
truncate table pagos         restart identity cascade;
truncate table cuotas        restart identity cascade;
truncate table suscripciones restart identity cascade;
truncate table alumnos       restart identity cascade;
truncate table pagadores     restart identity cascade;

-- 2. Borrar todos los usuarios de Supabase Auth.
--    auth.users tiene políticas internas que no permiten DELETE directo,
--    hay que usar la función admin de Supabase (que va por la API), o
--    correr este DELETE desde SQL Editor con permisos de service_role
--    (que es lo que tenés en el SQL Editor del dashboard).
delete from auth.users;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- Verificación rápida después del reset
-- ════════════════════════════════════════════════════════════════════════
select 'pagadores'     as tabla, count(*) as filas from pagadores
union all select 'alumnos',       count(*) from alumnos
union all select 'suscripciones', count(*) from suscripciones
union all select 'cuotas',        count(*) from cuotas
union all select 'pagos',         count(*) from pagos
union all select 'pagos_cuotas',  count(*) from pagos_cuotas
union all select 'auth.users',    count(*) from auth.users
union all select 'planes',        count(*) from planes
union all select 'configuracion', count(*) from configuracion;
