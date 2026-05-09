# Dashboard Financiero — Negocio de Comida (v2)

App web mobile-first / tablet con flujo POS para registrar ingresos, gastos, costos y manejar fiados. **Backend: Supabase** (cliente oficial `@supabase/supabase-js`). Autenticación tipo POS con sesión de dispositivo + PIN por empleado.

## Stack

- TanStack Start + React + Tailwind + shadcn/ui.
- **Supabase** directo con `@supabase/supabase-js` (sin Lovable Cloud).
  - Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (necesitaré que las agregues como secrets antes de codear).
- Cliente Supabase único en `src/integrations/supabase/client.ts` usando la anon key.
- Toda la lógica corre en frontend contra Supabase (sin server functions ni service role); seguridad enforced por RLS.

## Modelo de autenticación (POS)

- **Sesión de dispositivo**: una sola cuenta `device@negocio.com` (Supabase Auth, email/password) inicia sesión en la tablet y permanece logueada. Esa sesión es la que da acceso a Supabase via RLS.
- **Empleados**: NO son usuarios de Supabase Auth. Viven sólo en la tabla `empleados`.
- **Login de empleado (PIN)**: al abrir la app se muestra un teclado numérico. El frontend consulta `empleados` activos, compara `pin_hash` (bcryptjs en cliente) y guarda el `empleado_actual` en estado local (Zustand/Context) + `localStorage` (con auto-logout configurable, ej. 4h o cierre manual).
- **Auditoría**: cada `transaccion`, `deuda` y `abono` guarda `empleado_id` del empleado activo. El backend confía en ese campo porque la sesión del dispositivo es única y controlada (admin físico de la tablet).
- **Gating Admin**: la UI muestra/oculta acciones de Admin según el rol del empleado activo. RLS permite las operaciones (porque la sesión del dispositivo es válida), pero la app sólo expone los botones a admins. Para endurecer luego se puede mover el delete/update a Edge Functions, pero queda fuera de alcance v1.

## Esquema Supabase

Enums:

- `tipo_transaccion`: 'ingreso' | 'gasto' | 'costo'
- `metodo_pago`: 'efectivo' | 'transferencia'
- `rol_empleado`: 'admin' | 'empleado'
- `estado_deuda`: 'pendiente' | 'pagado'

Tablas:

- `empleados` (id uuid PK, nombre text, rol rol_empleado, pin_hash text, activo bool, created_at timestamptz)
- `productos` (id uuid PK, nombre text, precio numeric, activo bool, created_at)
- `clientes` (id uuid PK, nombre text, telefono text NULL, saldo_total numeric default 0, created_at)
- `transacciones` (id uuid PK, tipo tipo_transaccion, metodo_pago metodo_pago NULL, monto numeric, descripcion text, empleado_id uuid FK, origen text default 'manual', abono_id uuid NULL, created_at)
- `deudas` (id uuid PK, cliente_id uuid FK, producto_id uuid FK NULL, producto_nombre text, precio_unitario numeric, cantidad int default 1, monto numeric, estado estado_deuda default 'pendiente', empleado_id uuid FK, created_at, pagado_at timestamptz NULL)
- `abonos` (id uuid PK, cliente_id uuid FK, monto numeric, metodo_pago metodo_pago, empleado_id uuid FK, transaccion_id uuid FK, created_at)

Triggers/funciones:

- `actualizar_saldo_cliente()`: trigger en `deudas` y `abonos` que recalcula `clientes.saldo_total`.
- `aplicar_abono(cliente_id, monto, metodo, empleado_id)`: RPC que crea `abonos`, crea `transacciones` (ingreso) y marca deudas más antiguas como pagadas hasta cubrir el monto (FIFO). Atómico.

RLS (todas las tablas):

- Habilitada en todas.
- Política única por tabla: `USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated')` para SELECT/INSERT/UPDATE/DELETE.
- Esto cumple el requisito: cualquier sesión autenticada (= la del dispositivo) puede leer empleados para validar PINs y escribir transacciones con `empleado_id`.
- Sin sesión, todo bloqueado.

## Vistas (rutas TanStack)

```
src/routes/
  __root.tsx
  index.tsx                    → Dashboard (resumen del día)
  registro.tsx                 → Tabs: Caja Diaria / Fiados (POS)
  deudores.tsx                 → Lista de cuentas por cobrar
  deudores.$clienteId.tsx      → Detalle + abonar / pagar todo
  catalogo.tsx                 → CRUD productos (admin)
  empleados.tsx                → CRUD empleados + PIN (admin)
  historial.tsx                → Filtros + export CSV (admin)
  login.tsx                    → Login del dispositivo (email/password)
  pin.tsx                      → Selector de empleado + teclado PIN
  _authenticated.tsx           → exige sesión de dispositivo
  _authenticated/_pin.tsx      → exige empleado activo en estado local
```

### Vista 1 — Dashboard

4 tarjetas grandes del día: Ingresos Efectivo, Ingresos Transferencia, Costos, Gastos. Balance neto. Atajos a "Registrar" y "Cobrar fiado". Header muestra empleado activo + botón "Cambiar empleado".

### Vista 2 — Registro (≤3 toques)

- **Caja Diaria**: teclado numérico grande, selector Ingreso/Gasto/Costo, método (Efectivo/Transferencia), descripción opcional, botón Guardar.
- **Fiados (POS)**: buscador/dropdown de cliente con "+ Nuevo cliente" inline; grid de productos (botones grandes con nombre + precio); tap = +1 al carrito del cliente; carrito con − / + por línea; botón Confirmar guarda en `deudas`.

### Vista 3 — Cuentas por cobrar

Lista por saldo descendente con buscador. Detalle: items consumidos, saldo. Botones grandes **Pagar todo** (elige método, llama RPC) y **Abonar** (monto libre + método).

### Vista 4 — Catálogo / Empleados / Historial (Admin)

- Productos: crear, editar precio/nombre, desactivar.
- Empleados: crear, asignar PIN (hash bcryptjs), cambiar rol, desactivar.
- Historial: filtros por rango de fechas + tipo, exportar CSV (transacciones, deudas, abonos).

## UX / Diseño

- Mobile-first; tablet 3–4 columnas en grid POS.
- Botones ≥56px, tipografía grande, alto contraste.
- Tokens semánticos en `src/styles.css` (oklch): primario cálido (mostaza/terracota), success verde para ingresos, destructive rojo para egresos/deuda, warning amarillo para pendientes.
- Toasts (sonner) para confirmar cada acción.
- Bottom nav en móvil; sidebar colapsable en tablet.

## Validación / Seguridad cliente

- Zod en todos los formularios (montos > 0, nombres no vacíos, PIN exactamente 4 dígitos numéricos).
- bcryptjs para hashear PIN antes de guardarlo.
- Estado de empleado activo en Zustand persistido; auto-logout tras inactividad (configurable, default 4h).
- UI gating por rol; los botones admin se ocultan a empleados.

## Plan de implementación por fases

1. Setup Supabase: agregar secrets `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, crear cliente.
2. Migrations: enums, tablas, triggers de saldo, RPC `aplicar_abono`, RLS, semilla (admin inicial con PIN 0000 que pediré cambiar).
3. Diseño base: tokens, layout, bottom nav / sidebar, login de dispositivo, pantalla de PIN.
4. Dashboard.
5. Módulo de registro (Caja + POS de fiados).
6. Cuentas por cobrar (lista, detalle, abonos vía RPC).
7. Catálogo, Empleados, Historial + export CSV.
8. QA responsive móvil/tablet y verificación del flujo en ≤3 toques.

## Defaults asumidos (cámbialos si no te sirven)

- Tap a producto = +1 unidad; cantidad ajustable en el carrito.
- Costos sí llevan método de pago (para cuadrar caja).
- Una sola caja (sin multi-sucursal).
- PIN único de 4 dígitos por empleado, sin recuperación: el admin puede resetearlo desde Empleados.

## Lo que necesito de ti antes de empezar a codear

- Confirmar que vas a crear el proyecto en Supabase y darme `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` mediante el flujo de secrets.  
Respuesta: Hagamos la integracion en un click desde Lovable 
- Decidir el email/password de la cuenta de dispositivo (lo creamos juntos en el dashboard de Supabase) o si prefieres que la primera vez la app permita registrarla.  
Respuesta: el usuario de la tablet lo creamos en el dashboard de Supabase **NO** permitamos que la app tenga un botón de "Registrarse"