-- ════════════════════════════════════════════════════════════════════════
-- Migración 06 — Función para limpiar auth.users huérfanos
-- ════════════════════════════════════════════════════════════════════════
-- Problema que resuelve:
--   El TRUNCATE de la tabla `pagadores` no toca `auth.users`. Si un
--   pagador se intentó registrar y la inserción quedó a medias (o si
--   limpiamos pagadores sin limpiar auth), ese email queda huérfano en
--   auth.users y Supabase Auth devuelve 500 al intentar crearlo de
--   vuelta.
--
--   `admin.auth.admin.listUsers()` está paginado (50 por página por
--   default) y no es 100% confiable para encontrar al huérfano. Esta
--   función va directo a la tabla con un query indexado.
--
-- Cómo se usa desde el server action:
--   await admin.rpc('admin_delete_auth_user', { p_email: 'xxx@xxx.com' })
--
-- Permisos:
--   security definer + grant solo a service_role. Las claves anon /
--   authenticated NO pueden invocarla.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.admin_delete_auth_user(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count int;
begin
  delete from auth.users where lower(email) = lower(p_email);
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- Bloquear ejecución desde el cliente browser
revoke execute on function public.admin_delete_auth_user(text) from public;
revoke execute on function public.admin_delete_auth_user(text) from anon;
revoke execute on function public.admin_delete_auth_user(text) from authenticated;

-- Solo el service_role (que solo se usa server-side) puede invocarla
grant execute on function public.admin_delete_auth_user(text) to service_role;
