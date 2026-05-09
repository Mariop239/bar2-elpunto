
# Conectar a tu Supabase (ixbmxrtvkapzsspjfnjh)

## Lo que NO puedo hacer

- No puedo desactivar Lovable Cloud desde el chat. Eso lo tienes que hacer tú: **Connectors → Lovable Cloud → Disable Cloud**. Mientras Cloud esté activo, las variables `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y el archivo `src/integrations/supabase/types.ts` se regeneran automáticamente apuntando a `jykowyhaudaqvkzyskfn` y sobrescribirían cualquier cambio mío.
- No puedo correr migraciones contra tu proyecto. Tendrás que pegar el SQL en tu **SQL Editor** de Supabase manualmente.
- La herramienta `supabase--migration`, los tipos auto-generados, la rotación de claves y las edge functions administradas dejan de funcionar.

## Lo que necesito de ti antes de empezar

1. **Desactivar Lovable Cloud** en Connectors (paso obligatorio y manual).
2. **Anon key (public)** de tu proyecto: Supabase Dashboard → Project Settings → API → `anon` `public`.
3. **URL del proyecto**: `https://ixbmxrtvkapzsspjfnjh.supabase.co` (ya la tengo).
4. Confirmar que tu proyecto está **vacío** (si ya tiene tablas con otro esquema, hay que decidir si las borramos o adaptamos el código).

Cuando tengas los pasos 1–4, te pido la anon key con el flujo de secrets (no la pegues en el chat).

## Plan de implementación

### Paso 1 — Tú: desactivar Cloud y darme la anon key
- Desactivas Cloud en Connectors.
- Yo te lanzo `add_secret` para `MY_SUPABASE_URL` y `MY_SUPABASE_ANON_KEY`.

### Paso 2 — Yo: reescribir la capa de cliente
Archivos a modificar:
- `src/integrations/supabase/client.ts` → leer de `import.meta.env.VITE_MY_SUPABASE_URL` / `VITE_MY_SUPABASE_ANON_KEY` (o desde los secrets vía SSR).
- `src/integrations/supabase/auth-middleware.ts` → mismo cambio para SSR.
- **Eliminar** `src/integrations/supabase/client.server.ts` (no tendrás service role key disponible en el sandbox a menos que la pongas como secret aparte, lo cual no recomiendo).
- **Eliminar** `.env` y dejar que Vite lea solo los secrets.
- Confirmar que `types.ts` queda como está (snapshot manual; ya no se autoregenera).

### Paso 3 — Yo: entregarte el SQL completo
Un solo bloque idempotente con:
- Enums (`rol_empleado`, `metodo_pago`, `estado_deuda`, `tipo_transaccion`).
- Tablas (`empleados`, `productos`, `clientes`, `deudas`, `abonos`, `transacciones`).
- Funciones (`recalcular_saldo_cliente`, `aplicar_abono`, `trg_actualizar_saldo`).
- Triggers en `deudas` y `abonos`.
- RLS habilitado + políticas `device all` (modelo POS por dispositivo, igual que el actual).
- Trigger opcional `handle_new_auth_user` (opción C que discutimos) si lo confirmas.

Tú lo pegas en **SQL Editor** de tu Supabase y le das Run.

### Paso 4 — Tú: crear el primer usuario
- En **Authentication → Users → Add user**, creas tu correo + contraseña con `Auto-confirm: ON`.
- Si activamos el trigger `handle_new_auth_user`, se crea automáticamente la fila `empleados` con rol `admin` y PIN `1234`.

### Paso 5 — Verificación
- Abrir la app, hacer login, pasar el PIN, crear un cliente de prueba y una deuda.
- Confirmar que `saldo_total` se recalcula vía trigger.

## Detalles técnicos (referencia)

- `types.ts` queda congelado a la forma actual; si cambias el esquema en Supabase, tendrás que regenerarlo tú con `npx supabase gen types typescript --project-id ixbmxrtvkapzsspjfnjh`.
- Sin service role key, las operaciones admin desde server functions no podrán bypassear RLS. El modelo actual no las necesita (políticas `device all` con `true`), así que no es problema.
- Las edge functions de Lovable Cloud dejan de existir; si quieres deployar funciones tendrás que usar la CLI de Supabase tú mismo.

## Confirmaciones que necesito antes de implementar

1. ¿Confirmas que vas a desactivar Lovable Cloud en Connectors?
2. ¿Incluyo el trigger `handle_new_auth_user` (PIN por defecto `1234`, primer usuario = admin)?
3. ¿Tu proyecto Supabase está vacío o tiene datos que conservar?

Responde y procedo con la implementación cuando apruebes el plan.
