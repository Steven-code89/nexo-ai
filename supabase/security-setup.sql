-- ═══════════════════════════════════════════════════════════════════
--  Nexo AI — Seguridad de la tabla `mensajes`
--  Ejecutar en:  Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════
--
--  ANTES de ejecutar esto, hacé 2 cosas en el panel de Supabase:
--
--  1) Authentication → Sign In / Providers → Email:
--       DESACTIVAR "Allow new users to sign up".
--       (Si queda activo, cualquiera puede registrarse, quedar como
--        usuario "authenticated" y leer TODOS los mensajes.)
--
--  2) Authentication → Users → "Add user":
--       Creá tu usuario admin (email + contraseña, marcá "Auto Confirm").
--       Ese es el correo/clave que vas a usar en el panel de la web.
--
-- ───────────────────────────────────────────────────────────────────

alter table public.mensajes enable row level security;

-- Limpia políticas anteriores (si ya habías creado algunas)
drop policy if exists "anon puede insertar mensajes"       on public.mensajes;
drop policy if exists "solo auth puede leer mensajes"      on public.mensajes;
drop policy if exists "solo auth puede actualizar mensajes" on public.mensajes;
drop policy if exists "solo auth puede borrar mensajes"    on public.mensajes;

-- Cualquier visitante (anon) puede ENVIAR el formulario de contacto
create policy "anon puede insertar mensajes"
  on public.mensajes
  for insert
  to anon, authenticated
  with check (true);

-- Solo un usuario autenticado (vos) puede LEER los mensajes
create policy "solo auth puede leer mensajes"
  on public.mensajes
  for select
  to authenticated
  using (true);

-- Solo un usuario autenticado puede marcar como leído / editar
create policy "solo auth puede actualizar mensajes"
  on public.mensajes
  for update
  to authenticated
  using (true)
  with check (true);

-- Solo un usuario autenticado puede borrar
create policy "solo auth puede borrar mensajes"
  on public.mensajes
  for delete
  to authenticated
  using (true);

-- ───────────────────────────────────────────────────────────────────
--  OPCIONAL (más estricto): limitar a UN correo concreto.
--  Reemplazá las 3 políticas de select/update/delete de arriba por
--  versiones con este filtro, cambiando el email:
--
--    using ( (auth.jwt() ->> 'email') = 'tu-correo-admin@ejemplo.com' )
-- ───────────────────────────────────────────────────────────────────

-- Comprobación: revisá que RLS quedó activo y las políticas creadas
select tablename, policyname, cmd, roles
from pg_policies
where tablename = 'mensajes';
